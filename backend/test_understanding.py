import requests
import json

url = "http://localhost:8000/api/dataset-understanding/analyze"
with open("test_titanic.xlsx", "rb") as f:
    files = {"file": f}
    response = requests.post(url, files=files)

print("Status Code:", response.status_code)
if response.status_code == 200:
    data = response.json()
    print("Overview keys:", list(data["overview"].keys()))
    print("DataScope Summary:", data["datascope_summary"])
    print("Quality Snapshot:", data["quality_snapshot"])
    print("Column Dictionary (Insights for top 2):")
    for col in data["column_dictionary"][:2]:
        print(f" - {col['name']}: {col.get('insight', 'NO INSIGHT')}")
else:
    print("Error:", response.text)
