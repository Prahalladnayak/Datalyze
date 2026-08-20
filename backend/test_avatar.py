import asyncio
import os
import asyncpg
import ssl
import re
from dotenv import load_dotenv

load_dotenv()
dsn = os.getenv("DATABASE_URL")
clean_dsn = re.sub(r"[?&]sslmode=\w+", "", dsn) if dsn else None

async def main():
    ssl_ctx = ssl.create_default_context()
    # Apply our DNS patch to prevent connection timeout
    loop = asyncio.get_event_loop()
    original_getaddrinfo = loop.getaddrinfo
    import socket
    async def custom_getaddrinfo(host, port, *args, **kwargs):
        results = await original_getaddrinfo(host, port, *args, **kwargs)
        return sorted(results, key=lambda r: 0 if r[0] == socket.AF_INET else 1)
    loop.getaddrinfo = custom_getaddrinfo

    conn = await asyncpg.connect(dsn=clean_dsn, ssl=ssl_ctx)
    
    # 1. Inspect user before test (let's use user id = 1)
    user = await conn.fetchrow("SELECT id, email, avatar_url FROM users WHERE id = 1")
    print("Before test:")
    print(f"  User: id={user['id']}, email={user['email']}, avatar_url={user['avatar_url'][:50] if user['avatar_url'] else None}")

    # 2. Simulate manual profile photo update
    dummy_data_url = "data:image/jpeg;base64,dGVzdA=="
    await conn.execute("UPDATE users SET avatar_url = $1 WHERE id = 1", dummy_data_url)
    user_updated = await conn.fetchrow("SELECT id, email, avatar_url FROM users WHERE id = 1")
    print("After manual update:")
    print(f"  User: id={user_updated['id']}, email={user_updated['email']}, avatar_url={user_updated['avatar_url']}")

    # 3. Simulate Google Login flow
    # Suppose google_user picture is 'https://google-avatar-url.com/photo.jpg'
    google_picture = 'https://google-avatar-url.com/photo.jpg'
    
    # Fetch user during google login matching by email
    email = user['email']
    user_match = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)
    
    if user_match:
        # Check if avatar_url is updated / overwritten
        print(f"Google login matched user. Current avatar in DB: {user_match['avatar_url']}")
        # Google login logic check:
        # Expected behavior: Prevent Google login flow from overwriting avatar_url if user already has one.
        # We only want to use Google avatar on FIRST signup, or if they don't have one.
        # Wait, if user_match['avatar_url'] starts with 'https://lh3.googleusercontent.com', is it considered 'user-updated avatar'? No.
        # Wait! If they originally signed up via Google, their avatar_url is 'https://lh3.googleusercontent.com...'.
        # If they later manually updated it to a data URL, it is 'data:image/...'.
        # If we only set it if not user_match['avatar_url'], does it overwrite?
        # Let's test the condition:
        if not user_match["avatar_url"]:
            print("  Avatar was empty. Setting Google picture...")
            await conn.execute("UPDATE users SET avatar_url = $1 WHERE id = $2", google_picture, user_match['id'])
        else:
            print("  Avatar is NOT empty. Skipping Google picture overwrite.")
            
    # Refetch after login simulation
    final_user = await conn.fetchrow("SELECT id, email, avatar_url FROM users WHERE id = 1")
    print("After simulated Google Login:")
    print(f"  User: id={final_user['id']}, email={final_user['email']}, avatar_url={final_user['avatar_url']}")

    # Restore original avatar_url
    await conn.execute("UPDATE users SET avatar_url = $1 WHERE id = 1", user['avatar_url'])
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
