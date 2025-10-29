import os
import requests
import logging
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import io
import pandas as pd
import numpy as np

# ---------------- CONFIG ----------------
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Ensure CORS allows requests from your React frontend
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "*"]}})

# IMPORTANT: Ensure this key is valid and has not exceeded its quota.
API_KEY = os.getenv("SPOONACULAR_API_KEY", "4bab931c1e9b4b71880d69188f321e55")

# --- LOCAL DATASET CONFIG ---
# WARNING: This path might need adjustment based on where you run the script.
LOCAL_JSON_FILE = r'C:\Users\bivin\Favorites\Desktop\sem7\fsd\ocr-app\frontend\src\csvjson.json' 
LOCAL_DATASET = None # Placeholder for the combined Pandas DataFrame

# Mapping for the new JSON keys to match the standard required by the frontend
JSON_KEY_MAP = {
    "Dish Name": "food_name",
    "Calories (kcal)": "calories",
    "Carbohydrates (g)": "carbohydrates",
    "Protein (g)": "protein",
    "Fats (g)": "fat",
    "Free Sugar (g)": "sugar",
    "Fibre (g)": "fiber",
    "Sodium (mg)": "sodium",
    "Calcium (mg)": "calcium",
    "Iron (mg)": "iron",
    "Vitamin C (mg)": "vitamin_c",
    "Folate (µg)": "folate"
}

# Define all expected columns for a standardized dataset structure
ALL_EXPECTED_COLUMNS = [
    "food_name", "calories", "protein", "carbohydrates", "fat", 
    "calcium", "iron", "folate", "vitamin_c", "saturatedFat", 
    "cholesterol", "sodium", "fiber", "sugar"
]


try:
    pytesseract.get_tesseract_version()
except pytesseract.TesseractNotFoundError:
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# ---------------- DATA LOADING UTILITIES ----------------

def load_local_dataset():
    """Loads data from the local JSON file only."""
    global LOCAL_DATASET
    
    try:
        if os.path.isabs(LOCAL_JSON_FILE):
            json_path = LOCAL_JSON_FILE
        else:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            json_path = os.path.join(script_dir, LOCAL_JSON_FILE)
            
        logger.info(f"Attempting to load local JSON from: {json_path}")
        
        json_df = pd.read_json(json_path)
        
        json_df = json_df.replace('', 0, regex=False)
        
        json_df.rename(columns=JSON_KEY_MAP, inplace=True)
        
        for col in ALL_EXPECTED_COLUMNS:
            if col not in json_df.columns:
                json_df[col] = 0.0
                
        json_df = json_df[ALL_EXPECTED_COLUMNS]

        LOCAL_DATASET = json_df
        
        LOCAL_DATASET['calories'] = LOCAL_DATASET['calories'].round(0).astype(int)
        
        logger.info(f"Successfully loaded JSON dataset from {json_path} with {len(LOCAL_DATASET)} total records.")
        
    except FileNotFoundError:
        logger.error(f"FATAL ERROR: Local JSON file '{json_path}' not found. Please verify the absolute path, including the filename.")
    except Exception as e:
        logger.error(f"FATAL ERROR: Failed to parse local JSON dataset '{json_path}'. Check JSON syntax (must be wrapped in [ ]). Details: {e}")


# ---------------- CORE UTILITIES ----------------

def find_nutrient_amount(nutrients_list, name):
    """Helper to find a specific nutrient amount and return it as a float."""
    for n in nutrients_list:
        if n.get("name", "").lower() == name.lower():
            # Return amount rounded to 1 decimal place, or 0 if missing
            return round(n.get("amount", 0.0), 1)
    return 0.0

def preprocess_image(image):
    """Basic image preprocessing for OCR."""
    image = image.convert('L')
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)
    image = image.filter(ImageFilter.ModeFilter(size=3))
    return image
    
# --- NEW/UPDATED INGREDIENT CLEANING UTILITY ---

def clean_ingredients(ingredients_string):
    """
    Cleans up common OCR misspellings and prepares a comma-separated list
    for the Spoonacular API's includeIngredients parameter.
    """
    if not ingredients_string:
        return ""
        
    # Dictionary of common OCR errors -> correct spelling
    correction_map = {
        # --- General OCR spelling mistakes ---
    "teh": "the",
    "reciept": "receipt",
    "amout": "amount",
    "totl": "total",
    "balnce": "balance",
    "itm": "item",
    "nane": "name",
    "adrress": "address",
    "quanity": "quantity",
    "disount": "discount",
    "subtoal": "subtotal",
    "taxt": "tax",
    "produc": "product",
    "datc": "date",
    "numbcr": "number",
    "custmer": "customer",
    "paymnt": "payment",
    "recipt": "receipt",
    "prce": "price",
    "toatl": "total",
    "valie": "value",
    "weigth": "weight",
    "oder": "order",
    "detils": "details",
    "timw": "time"

        
    }
    
    # 1. Standardize and split by common delimiters
    raw_list = ingredients_string.lower().replace("\n", ",").split(',')
    
    cleaned_list = []
    for item in raw_list:
        item = item.strip()
        if not item:
            continue
            
        # Perform single word corrections within the item if necessary
        # This handles cases like 'cricken breast' -> 'chicken breast'
        corrected_item = " ".join([correction_map.get(word, word) for word in item.split()])
        cleaned_list.append(corrected_item)
            
    # Return the clean, comma-separated list, removing duplicates with set().
    return ",".join(list(set(cleaned_list)))


# ---------------- ENDPOINTS ----------------

@app.route('/ocr', methods=['POST'])
def perform_ocr():
    # If no image is provided, return a placeholder for manual entry flow
    if 'image' not in request.files:
        # A placeholder is returned to show the text area, as seen in your screenshot
        return jsonify({'text': 'rice, tomato, milk, sugar'}), 200

    image_file = request.files['image']
    if not image_file or image_file.filename == '':
        return jsonify({'error': 'Invalid or empty image file.'}), 400

    try:
        image_data = Image.open(io.BytesIO(image_file.read()))
        image_data = preprocess_image(image_data)
        text = pytesseract.image_to_string(image_data)

        if not text.strip():
            # If OCR detects nothing, return a placeholder
            return jsonify({'text': 'rice, tomato, milk, sugar'}), 200

        # Return the raw OCR text for the user to confirm/edit in the frontend
        return jsonify({'text': text.strip()}), 200
    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        return jsonify({'error': f'OCR failed: {str(e)}'}), 500


@app.route('/get_recipes', methods=['POST'])
def get_recipes():
    try:
        data = request.get_json()
        ingredients = data.get('ingredients', "")
        
        # Receive restrictions payload from the frontend
        restrictions = data.get('restrictions', {}) 
        diet = restrictions.get('diet', '')
        exclude_ingredients = restrictions.get('exclude', '') 

        if not ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        # 1. Clean and format the ingredient list
        cleaned_query = clean_ingredients(ingredients) 
        
        if not cleaned_query:
            return jsonify({"error": "Ingredients could not be processed into a valid search query."}), 400
            
        # 2. **CRITICAL FIX:** Use 'includeIngredients' instead of 'query'
        # Also include 'sort' parameter for better results
        url = (
            f"https://api.spoonacular.com/recipes/complexSearch?includeIngredients={cleaned_query}&number=8"
            f"&apiKey={API_KEY}"
            f"&diet={diet}" 
            f"&excludeIngredients={exclude_ingredients}" 
            f"&addRecipeInformation=true" 
            f"&sort=min-missing-ingredients" # Prioritizes recipes that use the most of our ingredients
        )
        
        logger.info(f"Original Ingredients: {ingredients}")
        logger.info(f"Spoonacular Query (includeIngredients): {cleaned_query}")
        logger.info(f"Spoonacular URL: {url}") 

        response = requests.get(url)
        response.raise_for_status() 

        recipes_list_raw = response.json().get('results', [])
        
        # Process and prepare recipes for frontend
        recipes_list = []
        for recipe in recipes_list_raw:
              # Complex search does not guarantee full nutrition data, but we extract what's available
              calories = recipe.get('nutrition', {}).get('nutrients', [{}])[0].get('amount', 0) if recipe.get('nutrition') else 0
              
              recipes_list.append({
                  "id": recipe['id'],
                  "title": recipe['title'],
                  "image": recipe.get('image'),
                  "nutrients": {"calories": int(calories)} # Ensure calories is an integer
              })

        return jsonify({'recipes': recipes_list}), 200

    except requests.exceptions.RequestException as e:
        logger.error(f"Spoonacular API call failed: {str(e)}")
        return jsonify({"error": f"Failed to fetch recipes from Spoonacular. Check API key/quota. Details: {e}"}), 500
    except Exception as e:
        logger.error(f"Spoonacular error in /get_recipes: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route('/get_recipe_details/<int:recipe_id>', methods=['GET'])
def get_recipe_details(recipe_id):
    # This endpoint remains the same for fetching full details for Spoonacular IDs.
    try:
        url = f"https://api.spoonacular.com/recipes/{recipe_id}/information?includeNutrition=true&apiKey={API_KEY}"
        response = requests.get(url)
        response.raise_for_status()

        data = response.json()

        # Flatten Spoonacular's nested nutrient structure
        nutrients_list = data.get("nutrition", {}).get("nutrients", [])

        recipe_nutrients = {
            # MACROS (React expects specific simple keys)
            "calories": int(find_nutrient_amount(nutrients_list, "Calories")),
            "protein": find_nutrient_amount(nutrients_list, "Protein"),
            "carbohydrates": find_nutrient_amount(nutrients_list, "Carbohydrates"),
            "fat": find_nutrient_amount(nutrients_list, "Fat"),
            
            # MICRONUTRIENTS (React needs these for the micro boxes)
            "calcium": find_nutrient_amount(nutrients_list, "Calcium"),
            "iron": find_nutrient_amount(nutrients_list, "Iron"),
            "folate": find_nutrient_amount(nutrients_list, "Folate"),
            "vitamin_c": find_nutrient_amount(nutrients_list, "Vitamin C"),
            
            # EXTRA NUTRIENTS FOR LOGGING (React needs these for the summary calculation)
            "saturatedFat": find_nutrient_amount(nutrients_list, "Saturated Fat"),
            "cholesterol": find_nutrient_amount(nutrients_list, "Cholesterol"),
            "sodium": find_nutrient_amount(nutrients_list, "Sodium"),
            "fiber": find_nutrient_amount(nutrients_list, "Fiber"),
            "sugar": find_nutrient_amount(nutrients_list, "Sugar"),
        }
        
        # Prepare ingredients list for display
        ingredients_list = [ing["original"] for ing in data.get("extendedIngredients", [])]
        
        recipe_data = {
            "id": data["id"],
            "title": data["title"],
            "image": data.get("image"),
            "ingredients": ingredients_list,
            "instructions": data.get("instructions", "Instructions not available."),
            "nutrients": recipe_nutrients
        }
        return jsonify(recipe_data), 200

    except requests.exceptions.RequestException as e:
        logger.error(f"Spoonacular API call failed: {str(e)}")
        return jsonify({"error": f"Failed to fetch recipe details. Check API key/quota. Details: {e}"}), 500
    except Exception as e:
        logger.error(f"Spoonacular error in /get_recipe_details: {str(e)}")
        return jsonify({'error': f"Internal server error: {str(e)}"}), 500


@app.route('/lookup_nutrition', methods=['POST'])
def lookup_nutrition():
    """
    Looks up nutrition for a single food name.
    1. Checks combined local dataset first (JSON data).
    2. Falls back to Spoonacular API if not found locally.
    """
    try:
        data = request.get_json()
        food_name = data.get('food_name', '').strip()

        if not food_name:
            return jsonify({"error": "Food name is required"}), 400

        # ==========================================================
        # 1. CHECK COMBINED LOCAL DATASET
        # ==========================================================
        if LOCAL_DATASET is not None:
            
            # Search 1: Strict exact match (case-insensitive, trimming whitespace)
            local_match = LOCAL_DATASET[
                LOCAL_DATASET['food_name'].astype(str).str.strip().str.lower() == food_name.lower()
            ]

            if local_match.empty:
                # Search 2: Broad substring match (in case user types a partial name)
                local_match = LOCAL_DATASET[
                    LOCAL_DATASET['food_name'].astype(str).str.contains(food_name, case=False, na=False)
                ]

            if not local_match.empty:
                # Match found! Return data from JSON.
                data = local_match.iloc[0].to_dict()
                
                # Format local data to match API response structure expected by the frontend
                nutrition_data = {
                    key: (int(data.get(key)) if key == 'calories' else float(data.get(key, 0.0))) 
                    for key in ALL_EXPECTED_COLUMNS if key != 'food_name'
                }
                nutrition_data['food_name'] = data.get('food_name')
                
                logger.info(f"Returning LOCAL nutrition data for: {food_name} (Source: JSON)")
                return jsonify(nutrition_data), 200
                
            logger.info(f"Local dataset lookup failed for: '{food_name}'. Attempting API fallback.")
            
        else:
            logger.warning(f"Local dataset is None. Skipping local lookup for: '{food_name}'. Attempting API fallback. Check the console for the FATAL ERROR log.")
        # ==========================================================
        # END LOCAL DATASET CHECK
        # ==========================================================


        # =========================================================
        # 2. FALLBACK TO API 
        # ==========================================================
        
        # Step 1: Search for ingredient ID
        search_url = f"https://api.spoonacular.com/food/ingredients/search?query={food_name}&number=1&apiKey={API_KEY}"
        response_data = None
        
        # Implementation of exponential backoff for API calls
        max_retries = 3
        retry_delay = 1 # Start with 1 second
        
        for attempt in range(max_retries):
            try:
                search_response = requests.get(search_url)
                search_response.raise_for_status()
                search_data = search_response.json()
                response_data = search_data
                break # Exit loop if successful
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    raise # Re-raise error if last attempt failed

        if not response_data or not response_data.get('results') or not response_data['results']:
            # This is the final error message if neither local nor API provides results.
            return jsonify({"error": f"Food item '{food_name}' not found locally or via API."}), 404
        
        ingredient_id = response_data['results'][0]['id']
        
        # Step 2: Get Nutrition by Ingredient ID (defaulting to 100 grams for consistency)
        info_url = f"https://api.spoonacular.com/food/ingredients/{ingredient_id}/information?amount=100&unit=grams&apiKey={API_KEY}"
        info_data = None
        retry_delay = 1 # Reset retry delay
        
        for attempt in range(max_retries):
            try:
                info_response = requests.get(info_url)
                info_response.raise_for_status()
                info_data = info_response.json()
                break # Exit loop if successful
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    raise # Re-raise error if last attempt failed
        
        nutrients_list = info_data.get("nutrition", {}).get("nutrients", [])

        if not nutrients_list:
            return jsonify({"error": f"Found '{food_name}' but no detailed nutrition data available."}), 404

        # Step 3: Map nutrients to React-friendly structure
        nutrition_data = {
            # MACROS
            "calories": int(find_nutrient_amount(nutrients_list, "Calories")),
            "protein": find_nutrient_amount(nutrients_list, "Protein"),
            "carbohydrates": find_nutrient_amount(nutrients_list, "Carbohydrates"),
            "fat": find_nutrient_amount(nutrients_list, "Fat"),
            
            # MICRONUTRIENTS/SECONDARY MACROS
            "calcium": find_nutrient_amount(nutrients_list, "Calcium"),
            "iron": find_nutrient_amount(nutrients_list, "Iron"),
            "folate": find_nutrient_amount(nutrients_list, "Folate"),
            "vitamin_c": find_nutrient_amount(nutrients_list, "Vitamin C"),
            "saturatedFat": find_nutrient_amount(nutrients_list, "Saturated Fat"),
            "cholesterol": find_nutrient_amount(nutrients_list, "Cholesterol"),
            "sodium": find_nutrient_amount(nutrients_list, "Sodium"),
            "fiber": find_nutrient_amount(nutrients_list, "Fiber"),
            "sugar": find_nutrient_amount(nutrients_list, "Sugar"),
        }
        
        # Add the original food name for the front end log
        nutrition_data['food_name'] = info_data.get('name', food_name)
        
        logger.info(f"Returning API nutrition data for: {food_name}")
        return jsonify(nutrition_data), 200

    except requests.exceptions.RequestException as e:
        logger.error(f"Spoonacular API call failed during lookup: {str(e)}")
        # Check if e has a response object before accessing status_code
        status_code = getattr(e.response, 'status_code', 500)
        if status_code in [401, 402, 403]:
            return jsonify({"error": "Spoonacular API Key Invalid or Quota Exceeded. Please check your key."}), status_code
        return jsonify({"error": f"API Connection Error: {e}"}), 500
    except Exception as e:
        logger.error(f"Error during nutrition lookup: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@app.route('/calculate_health_metrics', methods=['POST'])
def calculate_health_metrics():
    try:
        data = request.get_json()
        age = data.get('age')
        height = data.get('height')
        weight = data.get('weight')
        gender = data.get('gender')
        activity = data.get('activity')

        if not all([age, height, weight, gender, activity]):
            return jsonify({'error': 'Missing required health metrics'}), 400

        if gender == 'male':
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
        else:
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161

        activity_multipliers = {1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9}
        tdee = bmr * activity_multipliers.get(activity, 1.2)
        bmi = weight / ((height / 100) ** 2)

        results = {
            'bmi': round(bmi, 1),
            'calories_maintain': round(tdee, 0),
            'calories_mild_loss': round(tdee - 250, 0),
            'calories_weight_loss': round(tdee - 500, 0),
            'calories_extreme_loss': round(tdee - 750, 0),
        }
        return jsonify(results), 200

    except Exception as e:
        logger.error(f"Error calculating health metrics: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


if __name__ == '__main__':
    # Call the new loading function on startup to ingest the local JSON dataset
    load_local_dataset()
    
    # Check and log the final state of the local dataset after startup
    if LOCAL_DATASET is not None:
        logger.info(f"Local Data Status: READY. {len(LOCAL_DATASET)} records available.")
    else:
        logger.error("Local Data Status: FAILED. API fallback is mandatory for all requests.")
        
    if API_KEY == "4bab931c1e9b4b71880d69188f321e55":
        logger.warning("WARNING: Using default/placeholder API key. API calls may fail.")
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)