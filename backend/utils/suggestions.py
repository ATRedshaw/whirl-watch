import os
import json
import logging
import requests
from typing import Dict, List, Tuple, Any, Optional
from rapidfuzz import fuzz
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Constants
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# System prompt template
SYSTEM_PROMPT_TEMPLATE = """You are MovieSage, a strictly-focused Movie & TV recommendation engine.
Your ONLY job is to return 1-{max_items} recommendations that address the user's request.
Output format (and nothing else):

[
  {{"Name": "<Title 1>", "Type": "Movie" | "TV"}},
  ...
]

Hard rules
1. Reply with VALID JSON only. No markdown, no keys other than "Name" & "Type", no comments, no trailing commas, no text before/after the array.
2. "Type" must be exactly "Movie" or "TV".
3. Language: {language} (default: English).
4. Max chars for each Name: 100.
5. If user request is outside recommending movies/TV, refuse by returning an empty array: [].
6. No adult-only, extremist, hate, political persuasion, illegal, or disallowed content.
7. NO code, instructions, opinions, synopses, or spoilers—just titles.

Context variables
• user_request = {request}
• genre_hint   = {genre_hint}
• max_items    = {max_items}
• language     = {language}
• media_type   = {media_type}
"""

def call_groq(
    user_query: str = "Give me a completely random selection of media",
    genre_hint: str = "Any",
    max_items: int = 10,
    language: str = "English",
    media_type: str = "Any"
) -> str:
    """
    Send the prepared system + user prompt to the Groq API and
    return the raw response text, or 'Error: ...'.
    
    Args:
        user_query (str): The user's query for movie/TV recommendations
        genre_hint (str, optional): Genre hint for recommendations. Defaults to "Any".
        max_items (int, optional): Maximum number of recommendations. Defaults to 10.
        language (str, optional): Language for recommendations. Defaults to "English".
        media_type (str, optional): Type of media to recommend (Movie/TV/Any). Defaults to "Any".
        
    Returns:
        str: JSON response from Groq or error message
    """
    if not GROQ_API_KEY:
        error_msg = "Error: GROQ_API_KEY environment variable not set"
        logger.error(error_msg)
        return error_msg
    
    # Format the system prompt with provided values
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        request=user_query,
        genre_hint=genre_hint,
        max_items=max_items,
        language=language,
        media_type=media_type
    )
    
    # Prepare API request
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }
    
    payload = {
        "model": "llama3-70b-8192",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        response_data = response.json()
        content = response_data["choices"][0]["message"]["content"]
        
        # Check if content is valid JSON
        try:
            json.loads(content)
            return content
        except json.JSONDecodeError as e:
            error_msg = f"Error: Invalid JSON response from Groq: {str(e)}"
            logger.error(error_msg)
            return error_msg
            
    except requests.RequestException as e:
        error_msg = f"Error: Failed to call Groq API: {str(e)}"
        logger.error(error_msg)
        return error_msg
    except Exception as e:
        error_msg = f"Error: Unexpected error calling Groq: {str(e)}"
        logger.error(error_msg)
        return error_msg

def get_suggestions(
    query: str = "Give me a completely random selection of media", 
    genre_hint: str = "Any",
    max_items: int = 10,
    language: str = "English",
    media_type: str = "Any"
) -> Tuple[Dict[str, Any], int]:
    """
    Get AI title recommendations and enrich them with TMDB data.
    
    Args:
        query (str): The user's recommendation request
        genre_hint (str, optional): Genre hint for recommendations. Defaults to "Any".
        max_items (int, optional): Maximum number of recommendations. Defaults to 10.
        language (str, optional): Language for recommendations. Defaults to "English".
        media_type (str, optional): Type of media to recommend (Movie/TV/Any). Defaults to "Any".
        
    Returns:
        tuple: (response_dict, http_status_code)
        
        response_dict has the shape:
        {
            "page": 1,
            "results": [<TMDB objects with added "media_type">],
            "total_results": <int>,
            "total_pages": 1
        }
    """
    if not TMDB_API_KEY:
        logger.error("TMDB_API_KEY environment variable not set")
        return {"error": "TMDB API key not configured"}, 500
    
    try:
        # Step 1: Get recommendations from Groq
        groq_response = call_groq(
            user_query=query,
            genre_hint=genre_hint,
            max_items=max_items,
            language=language,
            media_type=media_type
        )
        
        if groq_response.startswith("Error:"):
            logger.error(f"Groq API error: {groq_response}")
            return {"error": groq_response}, 503
        
        # Step 2: Parse the JSON response
        try:
            recommendations = json.loads(groq_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq response: {str(e)}")
            return {"error": f"Failed to parse recommendations: {str(e)}"}, 500
        
        if not isinstance(recommendations, list):
            logger.error(f"Unexpected response format: {recommendations}")
            return {"error": "Invalid response format from recommendation engine"}, 500
        
        # Step 3: Search TMDB for each recommendation
        results = []
        
        for item in recommendations:
            if not isinstance(item, dict) or "Name" not in item or "Type" not in item:
                logger.warning(f"Skipping invalid recommendation item: {item}")
                continue
                
            media_type = "movie" if item["Type"] == "Movie" else "tv"
            
            try:
                # Call TMDB search API
                response = requests.get(
                    f"https://api.themoviedb.org/3/search/{media_type}",
                    params={
                        "api_key": TMDB_API_KEY,
                        "query": item["Name"],
                        "language": language if language != "Any" else "en-US",
                        "page": 1
                    },
                    timeout=10
                )
                response.raise_for_status()
                search_data = response.json()
                
                # Find best match using fuzzy matching
                best_match = None
                highest_ratio = 0
                
                for result in search_data.get("results", []):
                    title_field = "title" if media_type == "movie" else "name"
                    
                    if title_field in result:
                        ratio = fuzz.ratio(
                            item["Name"].lower(), 
                            result[title_field].lower()
                        )
                        
                        if ratio > highest_ratio:
                            highest_ratio = ratio
                            best_match = result
                
                # Only include matches with at least 60% similarity
                if best_match and highest_ratio >= 60:
                    best_match["media_type"] = media_type
                    results.append(best_match)
                else:
                    logger.info(f"No good match found for: {item['Name']}")
                    
            except requests.RequestException as e:
                logger.error(f"TMDB API error for {item['Name']}: {str(e)}")
                # Continue with other items rather than failing completely
        
        # Step 4: Build the TMDB-shaped response
        response_dict = {
            "page": 1,
            "results": results,
            "total_results": len(results),
            "total_pages": 1
        }
        
        return response_dict, 200
        
    except Exception as e:
        logger.exception(f"Unexpected error in get_suggestions: {str(e)}")
        return {"error": f"Failed to get suggestions: {str(e)}"}, 500

if __name__ == "__main__":
    # Simple demo with example parameters
    print("Fetching movie and TV show recommendations...")
    
    # Example call with default parameters
    suggestions, status_code = get_suggestions()
    
    if status_code == 200 and "results" in suggestions:
        print(f"\nFound {suggestions['total_results']} recommendations:")
        
        for i, item in enumerate(suggestions["results"], 1):
            media_type = item["media_type"]
            title_field = "title" if media_type == "movie" else "name"
            title = item.get(title_field, "Unknown Title")
            
            print(f"{i}. [{media_type.upper()}] {title}")
            
    else:
        print(f"Error ({status_code}): {suggestions.get('error', 'Unknown error')}")
