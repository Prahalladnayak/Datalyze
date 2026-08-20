import os
import google.generativeai as genai
from dotenv import load_dotenv

# Explicitly point to the absolute path of .env to survive process restarts from varied directories
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=ENV_PATH)

# Configure API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Use the latest model
model_id = "gemini-2.5-flash"

def generate_synthetic_data(
    dataset_name: str, 
    columns: list, 
    rows: int,
    target_type: str = "Classification",
    class_imbalance: str = "Low",
    correlation_strength: str = "Medium",
    mode: str = "manual",
    prompt_text: str = None,
    intent: str = None
) -> str:
    """
    Generates synthetic dataset rows using Gemini API.
    Returns the generated data as a CSV formatted string.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    if mode == "nl" and prompt_text:
        prompt = (
            f"Generate a synthetic dataset based strictly on this user request: '{prompt_text}'\n"
            f"The dataset must contain exactly {rows} rows (excluding the header).\n"
            f"Auto-generate realistic and appropriate column names, data types, and values suitable for this request.\n"
        )
    elif mode == "intent" and intent:
        prompt = (
            f"Generate a synthetic dataset for the '{dataset_name}'.\n"
            f"The dataset must contain exactly {rows} rows (excluding the header).\n"
            f"The columns must include exactly: {', '.join(columns)} and any other columns you deem necessary for {intent}.\n"
        )
        if intent == "Unsupervised Learning":
            prompt += f"- Critical: Do NOT generate a target column/variable. This is for clustering/unsupervised tasks.\n"
    else:
        prompt = (
            f"Generate a synthetic dataset for the '{dataset_name}' domain.\n"
            f"The dataset must contain exactly {rows} rows (excluding the header).\n"
            f"The columns must be exactly: {', '.join(columns)}.\n"
        )

    prompt += (
        f"\nDATASET CHARACTERISTICS (CRITICAL):\n"
        f"- Target Task / Intent: {target_type if mode != 'intent' else intent}. Provide suitable patterns.\n"
        f"- Class Imbalance (if categorical target exists): {class_imbalance}. If High, make one class dominate.\n"
        f"- Feature Correlation: {correlation_strength}. If High, make several numerical features mathematically correlated (e.g. collinear).\n\n"
        f"CRITICAL REQUIREMENTS:\n"
        f"1. Data must be highly coherent, realistic, and organized.\n"
        f"2. Maintain strict and logical relationships between columns (e.g., matching cities to respective countries, coherent age-to-income ratios, realistic dates/times).\n"
        f"3. Use appropriate and consistent data types for each column (e.g., integers for IDs/Counts, floats for Prices/Measurements, standard formats for Dates).\n"
        f"4. Do not include any row numbering, markdown tags, or explanations.\n"
        f"5. Output ONLY raw CSV text format exactly where the first line is the header and the next lines are the data rows."
    )

    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Super quick clean if the model outputs markdown wrapper
        if text.startswith("```"):
            lines = text.split('\n')
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = '\n'.join(lines)

        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to generate dataset using Gemini API: {str(e)}")

def generate_dataset_summary(profile_json: dict) -> str:
    """
    Takes a JSON-like dict of dataset statistics and uses Gemini to generate a short, human-readable
    summary explaining what the dataset represents. Neutral tone, no ML promises.
    """
    if not GEMINI_API_KEY:
        return "Insight generation failed. Please try again or check API key."
        
    prompt = (
        f"You are a Senior Data Analyst reviewing a new dataset.\n"
        f"Here are the core statistics for the dataset:\n"
        f"Rows: {profile_json.get('rows')}\n"
        f"Columns: {profile_json.get('columns')}\n"
        f"Column Breakdown:\n{list(profile_json.get('column_stats', {}).keys())}\n\n"
        f"Please act as an expert Data Scientist and provide a clear, storytelling-driven explanation of this dataset.\n"
        f"Do NOT exaggerate, do NOT invent facts or hallucinate medical details. Infer context ONLY from the dataset Name (if any) and the Column Breakdown.\n"
        f"REQUIRED FORMAT:\n"
        f"📊 AI Dataset Insights\n\n"
        f"• This dataset captures [explain what real-world problem the dataset represents based on its columns].\n"
        f"• It contains {profile_json.get('rows')} records with {profile_json.get('columns')} columns.\n"
        f"• The target column (infer it if obvious, otherwise say 'The primary focus') represents [target meaning in human language].\n"
        f"• The data is suitable for [what kind of ML task, e.g., binary classification, regression] to [why this dataset is useful].\n"
        f"• [Mention data quality if any missing value stats are given, e.g., No missing values were found / Some missing values exist].\n\n"
        f"USE strictly this exact 5-bullet structure. Keep it simple, clear, and analyst-toned. OUTPUT ONLY this text, no markdown codeblocks."
    )
    
    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        return {"ai_insights": response.text.strip(), "llm_status": "success"}
    except Exception as e:
        print(f"Gemini Summary Error: {e}")
        error_str = str(e).lower()
        if "429" in error_str or "quota" in error_str:
            return {"ai_insights": None, "llm_status": "quota_exceeded"}
        return {"ai_insights": None, "llm_status": "error"}

def generate_column_insights(profile_columns: dict) -> dict:
    """
    Generates short, 1-line human-readable insights for each column.
    """
    if not GEMINI_API_KEY:
        return {col: "Analysis unavailable (Missing API Key)." for col in profile_columns}
        
    prompt = (
        f"Analyze this dictionary where keys are column names and values are their data types:\n"
        f"{profile_columns}\n\n"
        f"For each column, provide a short (1 line), human-readable description of what the column likely represents.\n"
        f"Rules: Descriptive, not predictive. If meaning cannot be inferred confidently, output exactly: "
        f"'Column represents data with no explicit semantic meaning'.\n"
        f"Format output EXACTLY as a JSON object: {{\"ColumnName\": \"insight string\"}}"
    )
    
    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        import json
        insights = json.loads(text)
        return insights
    except Exception as e:
        print(f"Gemini Insights Error: {e}")
        return {}

def generate_xray_analysis(profile_json: dict) -> dict:
    """
    Generates structured AI analysis for the Data X-Ray module.
    Predicts column roles and overall dataset insights.
    """
    if not GEMINI_API_KEY:
        return {
            "column_roles": {},
            "insights": ["AI analysis unavailable (Missing API Key)."]
        }
        
    prompt = (
        f"Analyze this dataset statistics payload:\n"
        f"{profile_json}\n\n"
        f"Perform TWO tasks:\n"
        f"1. Predict the role of each column from the following options: ['Target', 'Feature', 'ID', 'Noise', 'Timestamp', 'Text'].\n"
        f"2. Provide exactly 3-4 bullet point 'auto insights' assessing the dataset's quality and characteristics. Consider things like class imbalance, high cardinality, suggested use-cases, and whether text columns exist.\n\n"
        f"Format output EXACTLY as valid JSON with NO markdown wrappers:\n"
        f"{{\n"
        f"  \"column_roles\": {{\"ColA\": \"Feature\", \"ColB\": \"Target\"}},\n"
        f"  \"insights\": [\"Insight 1\", \"Insight 2\", \"Insight 3\"]\n"
        f"}}"
    )
    
    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        import json
        analysis = json.loads(text)
        return analysis
    except Exception as e:
        print(f"Gemini X-Ray Error: {e}")
        return {
            "column_roles": {},
            "insights": ["Failed to generate auto-insights due to an AI processing error."]
        }

def structure_web_data(raw_text: str, intent: str | None = None) -> list:
    """
    Takes raw stripped web text and deterministically structures it into a tabular JSON array.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")
        
    intent_block = ""
    if intent and intent.strip():
        intent_block = f"CRITICAL USER INTENT: \"{intent}\"\nYou MUST heavily bias your extraction to focus exactly on fulfilling this intent. If they ask for prices, get prices. If they ask for tables, find tables. Ignore noise.\n\n"
        
    prompt = (
        f"You are an expert data parsing engine. I will provide a large raw text dump scraped from a website.\n"
        f"Your task is to identify and structure the data into a JSON array of objects.\n\n"
        f"{intent_block}"
        f"RULES:\n"
        f"1. Output ONLY a valid JSON array (`[ {{...}} ]`), ready for CSV export.\n"
        f"2. Use logical, short, snake_case column names. DO NOT summarize text.\n"
        f"3. If extracting numeric KPIs/Stats, structure it EXACTLY like:\n"
        f"   {{\n"
        f"     \"numeric_value\": \"25+\",\n"
        f"     \"label\": \"Years of Excellence\",\n"
        f"     \"section\": \"About Us\",\n"
        f"     \"source_context\": \"25+ years of academic excellence\",\n"
        f"     \"confidence\": \"High\"\n"
        f"   }}\n"
        f"4. **CRITICAL PRIORITY FOR BUSINESS/COLLEGES**: You MUST auto-prioritize extracting: Years, Rankings, Student counts, Faculty counts, Courses numbers, Infrastructure stats, Contact numbers, and Accreditation codes.\n"
        f"5. Do not include introductory text, explanations, or wrapper markdown like ```json.\n"
        f"6. Include EVERYTHING. Do not stop early. Do not summarize.\n\n"
        f"RAW TEXT DUMP:\n"
        f"\"\"\"\n{raw_text[:12000]}\n\"\"\""
    )
    
    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        import json
        structured_data = json.loads(text)
        if not isinstance(structured_data, list):
            structured_data = [structured_data]
            
        if len(structured_data) == 0:
            raise ValueError("No data extracted.")
            
        return structured_data
        
    except Exception as e:
        print(f"Gemini Web Structuring Error: {e}")
        # Final fallback text harvest if it fails
        try:
            return [{"extracted_text": line.strip()} for line in raw_text.split('\n') if len(line.strip()) > 30][:30]
        except:
             raise ValueError(f"Failed to structure data: {str(e)}")

def recommend_extraction(url: str, raw_text: str) -> list[str]:
    """
    Quickly analyzes the site and proposes 3 data extraction goals for the User Intent.
    """
    if not GEMINI_API_KEY:
         return []
         
    prompt = (
        f"Analyze this raw webpage text from {url}.\n"
        f"What are 3 distinct, highly valuable datasets a user could extract from this page?\n"
        f"Keep the suggestions very short (e.g., 'Company names and stock prices', 'Article headlines and authors').\n"
        f"Respond ONLY with a valid JSON array of strings.\n\n"
        f"RAW TEXT:\n{raw_text[:3000]}"
    )
    try:
        model = genai.GenerativeModel("gemini-1.5-flash") # Use flash for speed
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        import json
        recommendations = json.loads(text)
        if isinstance(recommendations, list):
            return recommendations[:3]
        return []
    except:
        return []

def recover_numeric_intelligence(raw_text: str, intent: str) -> str:
    """
    Aggressively hunts for ALL numbers embedded in text/UI, binds them to labels,
    and returns a summarized markdown mapping, especially when explicitly forced by user intent.
    """
    if not GEMINI_API_KEY:
        return ""
        
    prompt = (
        f"You are a Senior Data Extraction Architect operating in Deep Extraction Mode.\n"
        f"The user has commanded you to aggressively hunt for NUMBERS, METRICS, and STATS based on this intent: \"{intent}\"\n\n"
        f"RULES:\n"
        f"1. Scan the provided text dump for ANY numbers (percentages, years, counters, prices, quantities, rates).\n"
        f"2. **CRITICAL PRIORITY FOR BUSINESS/COLLEGES**: You MUST auto-prioritize finding: Years, Rankings, Student counts, Faculty counts, Courses numbers, Infrastructure stats, Contact numbers.\n"
        f"3. You MUST reconstruct implicit associations using this exact Markdown Table format:\n"
        f"   | Value | Label | Section | Source Context | Confidence |\n"
        f"   |-------|-------|---------|----------------|------------|\n"
        f"   | 100+  | Clients | Services | 'Trusted by 100+ top clients' | High |\n"
        f"4. Return ONLY the Markdown table. No intros. No wrappers.\n"
        f"5. Infer labels if missing, and mark 'Confidence'. DO NOT filter out 'unimportant' numbers.\n"
        f"6. If absolutely no numbers exist, return an empty string.\n\n"
        f"RAW TEXT:\n{raw_text[:15000]}"
    )
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash") # Reverted to flash to avoid standard free tier 429 quota locks
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # If the LLM apologizes or finds nothing
        if "no number" in text.lower() or "not find" in text.lower() or len(text) < 10:
            return ""
            
        return text
    except Exception as e:
        print(f"FAILED NUMERIC RECOVERY: {e}")
        return ""
