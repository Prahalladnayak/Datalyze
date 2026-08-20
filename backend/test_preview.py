import urllib.request, urllib.error;
try:
    print(urllib.request.urlopen("http://127.0.0.1:8000/api/kaggle/preview/imdevskp/covid19-corona-virus-india-dataset?limit=100").read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print(e)
