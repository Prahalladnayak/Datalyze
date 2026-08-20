import asyncio
import os
import re
import ssl
import sys
import httpx
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load env variables and ensure backend path is in Python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
load_dotenv()

# Mock random.randint to return 123456 consistently during test
import random
random.randint = lambda a, b: 123456

import app as app_module
from app import app
from database import init_db, get_connection, close_db

TEST_EMAIL = "test_qa_user@example.com"
TEST_NAME = "QA Test User"
TEST_PASSWORD = "QA_password_123!"
TEST_NEW_PASSWORD = "New_QA_password_999!"

async def db_cleanup(conn):
    """Clean up the test user from database tables to keep tests idempotent."""
    print("[TEST SETUP] Cleaning up any previous test data...")
    # Get user id if exists
    user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", TEST_EMAIL)
    if user:
        user_id = user["id"]
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
    # Setup database connection by running init_db (which runs migrations/patches DNS)
    await init_db()
    app_module.app_ready = True
    
    async with get_connection() as db_conn:
        await db_cleanup(db_conn)

        print("\nStarting HTTP Integration Tests...")
        
        # Use httpx.AsyncClient with lifespan to trigger startup/shutdown events
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            
            # ========================================================
            # TEST 1: Request OTP
            # ========================================================
            print("\n--- Test 1: Requesting OTP for new registration ---")
            resp = await client.post("/api/auth/signup/request-otp", json={"email": TEST_EMAIL})
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            data = resp.json()
            print(f"Request OTP response: {data}")
            assert "message" in data
            
            # Retrieve the OTP from DB (verify it is stored hashed)
            import hashlib
            otp_row = await db_conn.fetchrow("SELECT otp, expires_at, used FROM signup_otps WHERE email = $1", TEST_EMAIL)
            assert otp_row is not None, "OTP row should be created in DB"
            db_otp_hash = otp_row["otp"]
            assert db_otp_hash == hashlib.sha256(b"123456").hexdigest(), "OTP in DB should be SHA-256 hashed"
            db_otp = "123456"
            print(f"Verified: OTP stored in DB is hashed, plaintext is {db_otp}")

            # ========================================================
            # TEST 2: Verify with Invalid OTP
            # ========================================================
            print("\n--- Test 2: Verifying with Invalid OTP ---")
            resp = await client.post("/api/auth/signup/verify-otp", json={
                "name": TEST_NAME,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "otp": "000000" # wrong OTP
            })
            assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
            print(f"Invalid OTP response (Success error handling): {resp.json()}")

            # ========================================================
            # TEST 3: Verify with Expired OTP
            # ========================================================
            print("\n--- Test 3: Verifying with Expired OTP ---")
            # Artificially expire the OTP in the DB
            past_expiry = datetime.now(timezone.utc) - timedelta(minutes=5)
            await db_conn.execute("UPDATE signup_otps SET expires_at = $1 WHERE email = $2", past_expiry, TEST_EMAIL)
            
            resp = await client.post("/api/auth/signup/verify-otp", json={
                "name": TEST_NAME,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "otp": db_otp
            })
            assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
            print(f"Expired OTP response (Success error handling): {resp.json()}")
            
            # Reset OTP validity to allow proceeding with success test
            future_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
            await db_conn.execute("UPDATE signup_otps SET expires_at = $1 WHERE email = $2", future_expiry, TEST_EMAIL)

            # ========================================================
            # TEST 4: Verify with Valid OTP (Success Registration)
            # ========================================================
            print("\n--- Test 4: Verifying with Valid OTP (Should Succeed) ---")
            resp = await client.post("/api/auth/signup/verify-otp", json={
                "name": TEST_NAME,
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "otp": db_otp
            })
            assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
            reg_data = resp.json()
            print(f"Registration response: {reg_data}")
            assert "token" in reg_data
            assert reg_data["user"]["email"] == TEST_EMAIL
            
            # Verify single-use OTP
            otp_row = await db_conn.fetchrow("SELECT used FROM signup_otps WHERE email = $1", TEST_EMAIL)
            assert otp_row["used"] is True, "OTP must be marked as used"
            print("Verified: OTP is marked single-use (used = True)")

            # Verify password is hashed in DB
            user_row = await db_conn.fetchrow("SELECT hashed_password FROM users WHERE email = $1", TEST_EMAIL)
            assert user_row is not None
            assert user_row["hashed_password"] != TEST_PASSWORD, "Password must be hashed, not plaintext"
            print("Verified: Password stored is properly hashed")

            # ========================================================
            # TEST 5: Verify Duplicate / Fake Email Blocked
            # ========================================================
            print("\n--- Test 5: Requesting OTP for already existing email ---")
            resp = await client.post("/api/auth/signup/request-otp", json={"email": TEST_EMAIL})
            assert resp.status_code == 409, f"Expected 409 conflict, got {resp.status_code}"
            print(f"Duplicate email response (Success error handling): {resp.json()}")

            # ========================================================
            # TEST 6: Forgot Password Request (Existing Email)
            # ========================================================
            print("\n--- Test 6: Forgot Password Request (Existing Email) ---")
            resp = await client.post("/api/auth/forgot-password", json={"email": TEST_EMAIL})
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            forgot_data = resp.json()
            print(f"Forgot password response: {forgot_data}")
            
            # Get the reset token from DB
            token_row = await db_conn.fetchrow(
                "SELECT token FROM reset_tokens r JOIN users u ON r.user_id = u.id WHERE u.email = $1 AND r.used = 0", 
                TEST_EMAIL
            )
            assert token_row is not None, "Reset token must be generated in DB"
            reset_token = token_row["token"]
            print(f"Verified: Reset token generated in DB is {reset_token}")

            # ========================================================
            # TEST 7: Forgot Password Request (Non-existent Email)
            # ========================================================
            print("\n--- Test 7: Forgot Password Request (Non-existent Email) ---")
            resp = await client.post("/api/auth/forgot-password", json={"email": "non_existent_fake_user@example.com"})
            assert resp.status_code == 200, f"Expected 200 (generic security response), got {resp.status_code}"
            non_existent_data = resp.json()
            print(f"Non-existent email response (Security compliance): {non_existent_data}")
            assert "message" in non_existent_data
            assert "dev_reset_token" not in non_existent_data, "Should not return token for fake emails"

            # ========================================================
            # TEST 8: Reset Password with Invalid Token
            # ========================================================
            print("\n--- Test 8: Resetting Password with Invalid Token ---")
            resp = await client.post("/api/auth/reset-password", json={
                "token": "invalid-uuid-token",
                "new_password": TEST_NEW_PASSWORD
            })
            assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
            print(f"Invalid reset token response (Success error handling): {resp.json()}")

            # ========================================================
            # TEST 9: Reset Password with Valid Token
            # ========================================================
            print("\n--- Test 9: Resetting Password with Valid Token (Should Succeed) ---")
            resp = await client.post("/api/auth/reset-password", json={
                "token": reset_token,
                "new_password": TEST_NEW_PASSWORD
            })
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            print(f"Reset password response: {resp.json()}")
            
            # Verify token is single-use (marked used)
            token_row = await db_conn.fetchrow("SELECT used FROM reset_tokens WHERE token = $1", reset_token)
            assert token_row["used"] == 1, "Reset token should be marked as used"
            print("Verified: Reset token is marked single-use (used = 1)")

            # Verify we can login with the NEW password
            print("\n--- Test 9b: Login with the newly reset password ---")
            resp = await client.post("/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_NEW_PASSWORD
            })
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            login_data = resp.json()
            print(f"Login success using new password! Token: {login_data['token'][:20]}...")

            # Verify old password no longer works
            print("\n--- Test 9c: Login with the OLD password should be rejected ---")
            resp = await client.post("/api/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            assert resp.status_code == 401, f"Expected 401 unauthorized, got {resp.status_code}"
            print("Verified: Old password rejected successfully.")

        # Cleanup test data after successful runs
        await db_cleanup(db_conn)
        
    await close_db()
    print("\nALL QA AUTH FLOW TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    asyncio.run(run_tests())
