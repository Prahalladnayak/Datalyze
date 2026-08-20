import requests
import pandas as pd
import json
import os

BASE_URL = "http://127.0.0.1:8000/api"

def create_excel():
    df = pd.DataFrame({"Name": ["Alice", "Bob"], "Age": [25, 30]})
    df.to_excel("dummy.xlsx", index=False)

def test_upload_excel():
    print("\n--- Testing Excel Upload ---")
    try:
        create_excel()
        
        with open("dummy.xlsx", "rb") as f:
            files = {"file": ("dummy.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            response = requests.post(f"{BASE_URL}/clean/upload", files=files)
            
        print(f"Status Code: {response.status_code}")
        data = response.json()
        print(f"Upload Response JSON keys: {data.keys()}")
        print(f"Data Preview: {data['preview']}")
        
        if os.path.exists("dummy.xlsx"):
            os.remove("dummy.xlsx")
            
    except Exception as e:
        print(f"Upload error: {e}")

if __name__ == "__main__":
    test_upload_excel()
