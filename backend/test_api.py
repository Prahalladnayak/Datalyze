import requests
import time

def test_search():
    print("Testing /api/search with topic 'Finance'...")
    res = requests.post("http://127.0.0.1:8000/api/search", json={"query": "finance", "topic": "Finance"})
    
    if res.status_code == 200:
        data = res.json()
        print(f"Success! Found {len(data)} datasets.")
        if len(data) > 0:
            print(f"Sample dataset: {data[0]['name']}")
            print(f"Rows: {data[0]['rows']}, Cols: {data[0]['columns']}, Size: {data[0]['size_mb']} MB")
            print(f"Download URL: {data[0]['download_url']}")
    else:
        print(f"Search API failed: {res.status_code} - {res.text}")

def test_generate():
    print("Testing /api/generate with Anomalies...")
    payload = {
        "domain": "Finance",
        "size": 500,
        "features": ["ID", "CreditScore", "Income", "LoanAmount"],
        "complexity": "messy",
        "format": "csv",
        "add_missing_values": True,
        "add_outliers": True,
        "add_noise": True,
        "scaling": "standard"
    }
    start = time.time()
    res = requests.post("http://127.0.0.1:8000/api/generate", json=payload)
    end = time.time()
    
    if res.status_code == 200:
        data = res.json()
        print(f"Success! Generated {data['rows']} rows in {round(end-start, 2)} seconds.")
        print(f"Dataset ID: {data['dataset_id']}")
        print(f"Preview (First 2 rows): {data['preview'][:2] if data['preview'] else 'No Preview'}")
    else:
        print(f"Generate API failed: {res.status_code} - {res.text}")

if __name__ == "__main__":
    test_search()
    print("-" * 40)
    test_generate()
