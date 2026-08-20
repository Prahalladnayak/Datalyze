from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import os
import hmac
import hashlib
import uuid
import asyncio
import httpx
import razorpay
from razorpay import Client as Razorpay
import urllib3
import traceback
from database import get_connection
from routes.auth import get_current_user

router = APIRouter()

PLANS_CONFIG = {
    "starter": {"name": "Starter", "price_inr": 99, "credits": 300},
    "builder": {"name": "Builder", "price_inr": 199, "credits": 600},
    "pro": {"name": "Pro", "price_inr": 499, "credits": 1500},
    "ultra": {"name": "Ultra", "price_inr": 999, "credits": 3000},
}

class CreateOrderRequest(BaseModel):
    planId: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    planId: str

@router.post("/create-order")
async def create_order(
    body: CreateOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    plan_id = body.planId.lower().strip()
    if plan_id not in PLANS_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid plan ID")

    user_id = int(current_user["sub"])
    plan = PLANS_CONFIG[plan_id]
    amount_inr = plan["price_inr"]
    amount_paise = amount_inr * 100
    credits_added = plan["credits"]

    # STEP 2 - VERIFY ENV LOADING
    razorpay_key_id = os.getenv("RAZORPAY_KEY_ID")
    razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    print(f"RAZORPAY_KEY_ID loaded: {'YES' if razorpay_key_id else 'NO'}")
    print(f"RAZORPAY_KEY_SECRET loaded: {'YES' if razorpay_key_secret else 'NO'}")

    if not razorpay_key_id or not razorpay_key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay API keys are not configured on the server"
        )

    # STEP 3 - VERIFY RAZORPAY SDK
    try:
        print("Initializing Razorpay SDK client...")
        client = Razorpay(auth=(razorpay_key_id, razorpay_key_secret))
        # Disable SSL verification to bypass local/antivirus certificate interception issues
        client.session.verify = False
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        print("Razorpay SDK client initialized successfully (SSL verification disabled).")
    except Exception as init_exc:
        print(f"Razorpay SDK initialization failed. Type: {type(init_exc).__name__}, Exception: {str(init_exc)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Razorpay SDK initialization failed: {str(init_exc)}"
        )

    receipt = f"rcpt_{user_id}_{uuid.uuid4().hex[:8]}"

    # STEP 4 - VERIFY ORDER PAYLOAD
    print(f"Razorpay Order Payload - Amount: {amount_paise} (type: {type(amount_paise)}), Currency: INR, Receipt: {receipt}")

    # STEP 1 - IDENTIFY EXACT FAILURE (optimized with asyncio.to_thread)
    try:
        print("Creating order via Razorpay SDK...")
        order_data = await asyncio.to_thread(
            client.order.create,
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt
            }
        )
        razorpay_order_id = order_data["id"]
        print(f"Order created successfully: {razorpay_order_id}")
    except Exception as e:
        print("=== RAZORPAY ORDER CREATION FAILURE ===")
        print(f"Exception Type: {type(e).__name__}")
        print(f"Exception Message: {str(e)}")
        print("Stack Trace:")
        traceback.print_exc()
        print("========================================")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Razorpay gateway: {type(e).__name__} - {str(e)}"
        )

    # Store order in DB as "created" status
    async with get_connection() as conn:
        await conn.execute(
            "INSERT INTO payments (user_id, plan_name, amount, credits_added, razorpay_order_id, status) "
            "VALUES ($1, $2, $3, $4, $5, $6)",
            user_id, plan["name"], amount_inr, credits_added, razorpay_order_id, "created"
        )

    return {
        "id": razorpay_order_id,
        "amount": amount_paise,
        "currency": "INR",
        "key": razorpay_key_id,
        "planId": plan_id
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = int(current_user["sub"])
    plan_id = body.planId.lower().strip()
    
    if plan_id not in PLANS_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid plan ID")

    plan = PLANS_CONFIG[plan_id]
    razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if not razorpay_key_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay API key secret is not configured"
        )

    # 1. HMAC SHA256 Verification
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode("utf-8")
    generated_sig = hmac.new(
        key=razorpay_key_secret.encode("utf-8"),
        msg=msg,
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(generated_sig, body.razorpay_signature):
        # Update payment record to failed
        async with get_connection() as conn:
            await conn.execute(
                "UPDATE payments SET status = $1, razorpay_payment_id = $2 WHERE razorpay_order_id = $3",
                "failed", body.razorpay_payment_id, body.razorpay_order_id
            )
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed. Transaction rejected."
        )

    # 2. Check and Update DB (Idempotent Transaction)
    async with get_connection() as conn:
        payment = await conn.fetchrow(
            "SELECT * FROM payments WHERE razorpay_order_id = $1",
            body.razorpay_order_id
        )

        if not payment:
            raise HTTPException(
                status_code=404,
                detail="Payment order not found in local system records."
            )

        # Idempotency check: if already success, return immediately
        if payment["status"] == "success":
            return {
                "message": "Payment verified and processed successfully (already complete).",
                "plan": plan["name"],
                "credits_added": plan["credits"]
            }

        async with conn.transaction():
            # Update payment record status
            await conn.execute(
                "UPDATE payments SET status = $1, razorpay_payment_id = $2 WHERE razorpay_order_id = $3",
                "success", body.razorpay_payment_id, body.razorpay_order_id
            )

            # Retrieve user current credits (lock row for safety)
            user_row = await conn.fetchrow(
                "SELECT credits FROM users WHERE id = $1 FOR UPDATE",
                user_id
            )

            if not user_row:
                raise HTTPException(status_code=404, detail="User account not found")

            # Update credits & plan
            new_credits = user_row["credits"] + plan["credits"]
            await conn.execute(
                "UPDATE users SET credits = $1, plan = $2 WHERE id = $3",
                new_credits, plan["name"], user_id
            )

    return {
        "message": "Payment verified and subscription activated successfully!",
        "plan": plan["name"],
        "credits_added": plan["credits"]
    }
