import os
import re
import urllib.request
import urllib.error
import urllib.parse
from html.parser import HTMLParser
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import gemini_service

router = APIRouter()

class ExtractRequest(BaseModel):
    url: str
    intent: str | None = None

class StructureRequest(BaseModel):
    raw_text: str
    url: str
    intent: str | None = None

class RecommendRequest(BaseModel):
    url: str
    raw_text: str

# We keep this just as legacy if needed, but BeautifulSoup handles standard traversal.
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text_blocks = []
        self.skip_tags = {'script', 'style', 'nav', 'noscript', 'iframe', 'header', 'footer', 'aside', 'meta', 'link', 'svg'}
        self.current_tag = []
        self.in_skip_tag = False

    def handle_starttag(self, tag, attrs):
        self.current_tag.append(tag)
        if tag in self.skip_tags:
            self.in_skip_tag = True

    def handle_endtag(self, tag):
        if self.current_tag and self.current_tag[-1] == tag:
            self.current_tag.pop()
        self.in_skip_tag = any(t in self.skip_tags for t in self.current_tag)

    def handle_data(self, data):
        if not self.in_skip_tag:
            clean_text = data.strip()
            if clean_text:
                self.text_blocks.append(clean_text)
                
    def get_text(self):
        return '\n'.join(self.text_blocks)

def is_valid_url(url: str) -> bool:
    try:
        result = urllib.parse.urlparse(url)
        hostname = result.hostname or ""
        # Block private IPs and localhost
        if hostname in ['localhost', '127.0.0.1', '0.0.0.0'] or hostname.startswith('192.168.') or hostname.startswith('10.'):
            return False
        return all([result.scheme in ['http', 'https'], result.netloc])
    except ValueError:
        return False

def extract_meta_tags(html_content: str) -> str:
    """Extracts meta titles, descriptions, and open graph data."""
    meta_text = []
    
    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE | re.DOTALL)
    if title_match:
        meta_text.append(f"Title: {title_match.group(1).strip()}")
        
    desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']', html_content, re.IGNORECASE)
    if desc_match:
        meta_text.append(f"Description: {desc_match.group(1).strip()}")
        
    og_match = re.search(r'<meta[^>]*property=["\']og:description["\'][^>]*content=["\'](.*?)["\']', html_content, re.IGNORECASE)
    if og_match:
        meta_text.append(f"OG Description: {og_match.group(1).strip()}")
        
    return "\n".join(meta_text)

def extract_js_strings(html_content: str) -> str:
    """Extracts human-readable strings embedded deep inside SPA Javascript bundles."""
    script_pattern = r'<script[^>]*>(.*?)</script>'
    scripts = re.findall(script_pattern, html_content, re.IGNORECASE | re.DOTALL)
    
    text_strings = []
    for script in scripts:
        # Match long strings that look like human text, with spaces and punctuation, no HTML/JS tokens
        strings = re.findall(r'["\']([A-Z][a-zA-Z0-9\s,\.\-!]{30,300})["\']', script)
        for s in strings:
            if '{' not in s and '<' not in s and '=>' not in s and '$' not in s:
                text_strings.append(s)
                
    # Return top unique UI strings to give Gemini some context
    unique_strings = list(set(text_strings))
    return "\n".join(unique_strings[:30])

def extract_state_payloads(html_content: str) -> str:
    """Extracts hidden JSON API states embedded in modern JS Apps (Next.js, JSON-LD, etc)."""
    payloads = []
    import json
    
    # 1. Standard application/json or ld+json
    pattern = r'<script[^>]*type=["\']application/(?:ld\+)?json["\'][^>]*>(.*?)</script>'
    matches = re.findall(pattern, html_content, re.IGNORECASE | re.DOTALL)
    for match in matches:
        try:
            json.loads(match.strip())
            payloads.append(match.strip())
        except:
            pass
            
    # 2. Next.js / Nuxt / universal state payloads
    next_pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'
    next_matches = re.findall(next_pattern, html_content, re.IGNORECASE | re.DOTALL)
    if next_matches:
        payloads.extend(next_matches)
        
    return "\n\n".join(payloads)

@router.post("/raw")
async def extract_raw_data(request: ExtractRequest):
    """
    Fetches the public URL server-side and extracts raw unstructured text, removing ads, scripts, and clutter.
    """
    if not is_valid_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid or unsupported URL format. Please provide a public HTTP/HTTPS link.")
        
    try:
        html_content = ""
        is_js_rendered = False
        
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    java_script_enabled=True,
                    bypass_csp=True
                )
                page = await context.new_page()
                try:
                    await page.goto(request.url, wait_until="networkidle", timeout=12000)
                except:
                    # Timeouts are fine, we just take the DOM as it is
                    pass
                html_content = await page.content()
                await browser.close()
                is_js_rendered = True
        except Exception as e:
            # Fallback to urllib if Playwright fails completely
            req = urllib.request.Request(
                request.url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                html_content = response.read().decode('utf-8', errors='ignore')
                
        # Use BeautifulSoup to rigorously extract the entire DOM natively
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")
        
        output_blocks = []
        
        # 1. JSON-LD STRUCTURED DATA
        for script in soup.find_all("script", type=re.compile(r'application/(ld\+)?json', re.I)):
            if script.string:
                output_blocks.append(f"--- STRUCTURED DATA (JSON-LD) ---\n{script.string.strip()}\n---------------------------------\n")
        
        # Remove explicitly strictly non-data elements
        for el in soup(["script", "style", "noscript", "svg", "path", "meta", "link", "head", "iframe"]):
            el.extract()
            
        # 2. RECONSTRUCT TABLES ROW-BY-ROW
        for table in soup.find_all("table"):
            table_text = ["\n[TABLE START]"]
            for row in table.find_all("tr"):
                cols = row.find_all(["th", "td"])
                row_text = " | ".join(c.get_text(separator=' ', strip=True) for c in cols)
                table_text.append(row_text)
            table_text.append("[TABLE END]\n")
            
            new_tag = soup.new_tag("div")
            new_tag.string = "\n".join(table_text)
            table.replace_with(new_tag)
            
        # 3. RECONSTRUCT LISTS
        for ul in soup.find_all(["ul", "ol"]):
            list_text = ["\n[LIST START]"]
            for li in ul.find_all("li", recursive=False):
                list_text.append(f"  • {li.get_text(separator=' ', strip=True)}")
            list_text.append("[LIST END]\n")
            
            new_tag = soup.new_tag("div")
            new_tag.string = "\n".join(list_text)
            ul.replace_with(new_tag)

        # 4. RECONSTRUCT LINKS WITH ANCHOR TEXT
        for a in soup.find_all("a"):
            href = a.get("href", "")
            text = a.get_text(separator=' ', strip=True)
            if text and href and not href.startswith("javascript:") and not href.startswith("#"):
                new_tag = soup.new_tag("span")
                new_tag.string = f" [LINK: {text}]({href}) "
                a.replace_with(new_tag)
            
        raw_text = soup.get_text(separator='\n', strip=True)
        raw_text = re.sub(r'\n{3,}', '\n\n', raw_text).strip()
        
        # Prepend Structured data
        raw_text = "".join(output_blocks) + raw_text
        
        js_payloads = extract_state_payloads(html_content)
        
        # Append JS Payloads if they exist (Next.js data etc)
        if js_payloads:
            raw_text += "\n\n--- EMBEDDED JS STATE PAYLOADS ---\n\n" + js_payloads
            is_js_rendered = True
            
        # USER INTENT OVERRIDE (Pure Python / Scanning Nodes)
        is_numeric_intent = False
        is_all_data = False
        intent_value = request.intent
        if intent_value is not None:
            intent_lower = str(intent_value).lower()
            keywords = ['number', 'numeric', 'metric', 'stat', 'column', 'count', 'price', 'percentage', 'quantit', 'value', 'year']
            is_numeric_intent = any(kw in intent_lower for kw in keywords)
            if 'all' in intent_lower or 'everything' in intent_lower:
                is_all_data = True
        
        if is_numeric_intent and not is_all_data:
            # If user strictly wants numeric data, we scan RAW text and isolate blocks with numbers
            # We keep paragraphs/lines that have digits to satisfy "scan ALL DOM nodes for numbers"
            numeric_lines = []
            for line in raw_text.split('\n'):
                if any(char.isdigit() for char in line) or "[TABLE" in line or "[LIST" in line:
                    numeric_lines.append(line)
            if numeric_lines:
                raw_text = "--- NUMERIC SCAN FILTER APPLIED (PURE DOM EXTRACT) ---\n" + "\n".join(numeric_lines)
        
        if len(raw_text.strip()) < 500:
            status_reason = "Extraction yielded extremely limited data (< 500 chars). Possible reasons: Heavy JS block that bypassed Playwright headless mode, Login wall, Anti-bot protection (Cloudflare)."
            raw_text = f"--- EXTRACTION WARNING ---\n{status_reason}\n\n" + raw_text
                
        return {
            "raw_data": raw_text.strip()[:20000],  # Increased cap to 20k to handle large raw DOM dumps
            "url": request.url,
            "is_js_rendered": is_js_rendered
        }
            
    except urllib.error.URLError as e:
        raise HTTPException(status_code=400, detail=f"Failed to reach the website. The target might block automated traffic. ({str(e.reason)})")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Extraction failed safely: {str(e)}")

@router.post("/recommend")
async def recommend_intent(request: RecommendRequest):
    """
    Takes the raw text snippet and recommends 3 extraction intents.
    """
    try:
        recommendations = gemini_service.recommend_extraction(request.url, request.raw_text)
        return {"recommendations": recommendations}
    except Exception as e:
        return {"recommendations": []}

@router.post("/structure")
async def structure_data(request: StructureRequest):
    """
    Receives raw text and an optional intent from the frontend.
    Asks Gemini to infer tables and columns deterministically, heavily biased by intent.
    """
    try:
        structured_json = gemini_service.structure_web_data(request.raw_text, request.intent)
        return {"data": structured_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to structure data: {str(e)}")
