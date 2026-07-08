import os
import requests

def search_nearby_places(query: str, location: str) -> str:
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        return "Error: GOOGLE_PLACES_API_KEY not set."
    
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress"
    }
    payload = {
        "textQuery": f"{query} in {location}",
        "maxResultCount": 3
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        data = response.json()
        places = data.get("places", [])
        if not places:
            return f"No results found for {query} in {location}."
        results = []
        for p in places:
            name = p.get("displayName", {}).get("text", "Unknown")
            addr = p.get("formattedAddress", "Unknown")
            results.append(f"- {name} ({addr})")
        return "Found the following places:\n" + "\n".join(results)
    except Exception as e:
        return f"Error calling Places API: {e}"

def search_local_news(query: str) -> str:
    # Google Programmable Search (Custom Search JSON API) — the Google-native
    # replacement for Tavily. Needs an API key with "Custom Search API" enabled
    # plus a Search Engine id (cx). Key falls back to GOOGLE_API_KEY.
    key = os.environ.get("GOOGLE_SEARCH_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    cx = os.environ.get("GOOGLE_SEARCH_CX")
    if not key or not cx:
        return "Error: GOOGLE_SEARCH_API_KEY/GOOGLE_API_KEY and GOOGLE_SEARCH_CX not set."

    url = "https://www.googleapis.com/customsearch/v1"
    params = {
        "key": key,
        "cx": cx,
        "q": query,
        "num": 3,
        "dateRestrict": "m1",  # bias toward the last month, like the old news window
    }
    try:
        response = requests.get(url, params=params, timeout=5)
        data = response.json()
        results = data.get("items", [])
        if not results:
            return f"No recent news found for query: {query}."
        snippets = []
        for r in results:
            snippets.append(f"- {r.get('title')}: {r.get('snippet')}")
        return "Found the following search results:\n" + "\n".join(snippets)
    except Exception as e:
        return f"Error calling Custom Search API: {e}"
