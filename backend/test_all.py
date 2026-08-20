import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000/api"

def test_search():
    print("\n--- Testing Search ---")
    try:
        # We changed this to a GET request to /api/kaggle/search
        response = requests.get(f"{BASE_URL}/kaggle/search", params={"query": "Machine Learning"})
        print(f"Status Code: {response.status_code}")
        data = response.json()
        print(f"Items found: {len(data)}")
        if len(data) > 0:
            print("First item:", data[0]['name'])
    except Exception as e:
        print(f"Search error: {e}")

def test_generate():
    print("\n--- Testing Generate ---")
    try:
        payload = {
            "domain": "Test", 
            "size": 15, 
            "features": ["ID", "Name", "Age", "Salary"], 
            "complexity": "clean", 
            "format": "csv", 
            "add_missing_values": False, 
            "add_outliers": False, 
            "add_noise": False, 
            "scaling": "none"
        }
        response = requests.post(f"{BASE_URL}/generate", json=payload)
        print(f"Status Code: {response.status_code}")
        data = response.json()
        print(f"Generated successfully: {data.get('message')}")
        print(f"Preview rows: {len(data.get('preview', []))}")
    except Exception as e:
        print(f"Generate error: {e}")

def test_upload():
    print("\n--- Testing Upload ---")
    try:
        # Create dummy csv
        with open("dummy.csv", "w") as f:
            f.write("A,B,C\n1,2,3\n4,5,6")
            
        with open("dummy.csv", "rb") as f:
            files = {"file": ("dummy.csv", f, "text/csv")}
            response = requests.post(f"{BASE_URL}/clean/upload", files=files)
            
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        os.remove("dummy.csv")
    except Exception as e:
        print(f"Upload error: {e}")

if __name__ == "__main__":
    test_search()
    test_generate()
    test_upload()
