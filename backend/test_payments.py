import asyncio
import os
import sys
import hmac
import hashlib
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from unittest.mock import patch, MagicMock

# Ensure backend path is in Python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
load_dotenv()

# Set Razorpay environment variables for the test suite
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_SvZgc7Xp0UT3Cm"
os.environ["RAZORPAY_KEY_SECRET"] = "6UVRr1QKPgAIlridUPPnLe6D"

# Mock random.randint to return 123456 consistently during test
import random
random.randint = lambda a, b: 123456

import app as app_module
from app import app
from database import init_db, get_connection, close_db

TEST_EMAIL = "payment_tester@example.com"
TEST_NAME = "Payment Tester User"
TEST_PASSWORD = "Test_password_123!"

# Save the original post method to bypass mock for test app requests
original_post = httpx.AsyncClient.post

async def mock_post_side_effect(self, url, *args, **kwargs):
    # Check if the request is to Razorpay API
    if "api.razorpay.com" in str(url):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        
        # Determine plan price based on receipt/receipt format
        json_body = kwargs.get("json", {})
        amount = json_body.get("amount", 9900)
        
        # Return starter order or builder order depending on requested amount
        order_id = "order_test_99999"
        if amount == 19900:
            order_id = "order_test_tamper"
            
        mock_resp.json.return_value = {
            "id": order_id,
            "amount": amount,
            "currency": "INR",
            "receipt": json_body.get("receipt", "rcpt_test_123")
        }
        return mock_resp
    else:
        # Call the original post method for local test client requests
        return await original_post(self, url, *args, **kwargs)

async def db_cleanup(conn):
    """Clean up the test user and payment records from database tables to keep tests idempotent."""
    print("[TEST SETUP] Cleaning up any previous payment test data...")
    user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", TEST_EMAIL)
    if user:
        user_id = user["id"]
        # Delete related payments
        await conn.execute("DELETE FROM payments WHERE user_id = $1", user_id)
        # Delete related reset tokens
        await conn.execute("DELETE FROM reset_tokens WHERE user_id = $1", user_id)
        # Delete related activity logs
        await conn.execute("DELETE FROM activity_logs WHERE user_id = $1", user_id)
        # Delete user
        await conn.execute("DELETE FROM users WHERE id = $1", user_id)
    # Delete signup OTP
    await conn.execute("DELETE FROM signup_otps WHERE email = $1", TEST_EMAIL)
    print("[TEST SETUP] Cleanup done.")

async def run_tests():
    await init_db()
    app_module.app_ready = True
    
    async with get_connection() as db_conn:
        await db_cleanup(db_conn)

        print("\nStarting Payments Integration Tests...")
        
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            
            # Apply the mock using patch.object with a side effect
            mock_razorpay = MagicMock()
            mock_razorpay.order.create = lambda data: {
                "id": "order_test_tamper" if data.get("amount") == 19900 else "order_test_99999",
                "amount": data.get("amount", 9900),
                "currency": "INR",
                "receipt": data.get("receipt", "rcpt_test_123")
            }
            mock_session = MagicMock()
            mock_session.verify = True
            mock_razorpay.session = mock_session

            p1 = patch("routes.payments.Razorpay", return_value=mock_razorpay)
            p2 = patch.object(httpx.AsyncClient, "post", autospec=True, side_effect=mock_post_side_effect)
            p1.start()
            p2.start()
            try:
                
                # ========================================================
                # STEP 1: Create and Authenticate Test User
                # ========================================================
                print("\n--- Step 1: Registering test user ---")
                otp_req = await client.post("/api/auth/signup/request-otp", json={"email": TEST_EMAIL})
                assert otp_req.status_code == 200
                
                verify_req = await client.post("/api/auth/signup/verify-otp", json={
                    "name": TEST_NAME,
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD,
                    "otp": "123456"
                })
                assert verify_req.status_code == 201, f"Expected 201, got {verify_req.status_code}: {verify_req.text}"
                auth_data = verify_req.json()
                token = auth_data["token"]
                headers = {"Authorization": f"Bearer {token}"}
                print("Registered and logged in. JWT Token obtained.")

                # Get user id
                user_row = await db_conn.fetchrow("SELECT id, credits, plan FROM users WHERE email = $1", TEST_EMAIL)
                user_id = user_row["id"]
                print(f"Initial state: User ID = {user_id}, Credits = {user_row['credits']}, Plan = '{user_row['plan']}'")
                assert user_row["credits"] == 100
                assert user_row["plan"] == "Explorer"

                # ========================================================
                # STEP 2: Create Order (Mocked Razorpay Gateway)
                # ========================================================
                print("\n--- Step 2: Testing Order Creation ---")
                resp = await client.post("/api/payments/create-order", json={"planId": "starter"}, headers=headers)
                assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
                
                data = resp.json()
                print(f"Order created successfully: {data}")
                assert data["id"] == "order_test_99999"
                assert data["amount"] == 9900
                assert data["planId"] == "starter"
                assert data["key"] == "rzp_test_SvZgc7Xp0UT3Cm"

                # Verify entry in payments table
                payment_row = await db_conn.fetchrow("SELECT * FROM payments WHERE razorpay_order_id = $1", "order_test_99999")
                assert payment_row is not None
                assert payment_row["status"] == "created"
                assert payment_row["amount"] == 99
                assert payment_row["credits_added"] == 300
                assert payment_row["user_id"] == user_id
                print("Payment record verified in DB with status 'created'.")

                # ========================================================
                # STEP 3: Verify Payment - Success
                # ========================================================
                print("\n--- Step 3: Verifying Signature - Valid Signature ---")
                order_id = "order_test_99999"
                payment_id = "pay_test_88888"
                
                # Generate valid HMAC signature
                msg = f"{order_id}|{payment_id}".encode("utf-8")
                secret = os.environ["RAZORPAY_KEY_SECRET"]
                valid_sig = hmac.new(key=secret.encode("utf-8"), msg=msg, digestmod=hashlib.sha256).hexdigest()

                verify_payload = {
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": valid_sig,
                    "planId": "starter"
                }

                resp = await client.post("/api/payments/verify", json=verify_payload, headers=headers)
                assert resp.status_code == 200, f"Verification failed: {resp.text}"
                
                data = resp.json()
                print(f"Verification response: {data}")
                assert "verified and subscription activated" in data["message"]
                assert data["plan"] == "Starter"
                assert data["credits_added"] == 300

                # Verify DB updates
                payment_row = await db_conn.fetchrow("SELECT status, razorpay_payment_id FROM payments WHERE razorpay_order_id = $1", order_id)
                assert payment_row["status"] == "success"
                assert payment_row["razorpay_payment_id"] == payment_id

                user_row = await db_conn.fetchrow("SELECT credits, plan FROM users WHERE id = $1", user_id)
                print(f"Post-payment state: Credits = {user_row['credits']}, Plan = '{user_row['plan']}'")
                assert user_row["credits"] == 400  # 100 initial + 300 added
                assert user_row["plan"] == "Starter"
                print("Success: DB correctly updated users credits and plan.")

                # ========================================================
                # STEP 4: Verify Payment - Idempotency Check (Double Verification)
                # ========================================================
                print("\n--- Step 4: Testing Double Verification Idempotency ---")
                resp = await client.post("/api/payments/verify", json=verify_payload, headers=headers)
                assert resp.status_code == 200
                assert "already complete" in resp.json()["message"]

                # Double check user credits did not increase again
                user_row = await db_conn.fetchrow("SELECT credits FROM users WHERE id = $1", user_id)
                assert user_row["credits"] == 400
                print("Success: Double verification handled properly (credits added only once).")

                # ========================================================
                # STEP 5: Verify Payment - Tampered Signature Rejection
                # ========================================================
                print("\n--- Step 5: Testing Signature Rejection (Tampered Signature) ---")
                # Create a new order for this test
                await client.post("/api/payments/create-order", json={"planId": "builder"}, headers=headers)

                verify_payload_tampered = {
                    "razorpay_order_id": "order_test_tamper",
                    "razorpay_payment_id": "pay_test_tamper",
                    "razorpay_signature": "invalid_tempered_signature_123456",
                    "planId": "builder"
                }

                resp = await client.post("/api/payments/verify", json=verify_payload_tampered, headers=headers)
                assert resp.status_code == 400
                print(f"Tampered signature rejected successfully with status 400: {resp.json()}")

                # Verify DB payment is marked as failed
                payment_row = await db_conn.fetchrow("SELECT status FROM payments WHERE razorpay_order_id = $1", "order_test_tamper")
                assert payment_row["status"] == "failed"

                # Verify user credits did not increase
                user_row = await db_conn.fetchrow("SELECT credits FROM users WHERE id = $1", user_id)
                assert user_row["credits"] == 400
                print("Success: Tampered signature rejected, credits unmodified, payment status set to 'failed'.")

                # ========================================================
                # STEP 6: DB Cleanup
                # ========================================================
                await db_cleanup(db_conn)
            finally:
                p1.stop()
                p2.stop()

    print("\nALL PAYMENTS QA INTEGRATION TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    asyncio.run(run_tests())
