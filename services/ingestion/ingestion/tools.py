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
    key = os.environ.get("TAVILY_API_KEY")
    if not key:
        return "Error: TAVILY_API_KEY not set."
    
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": key,
        "query": query,
        "search_depth": "basic",
        "include_answer": False,
        "max_results": 3
    }
    try:
        response = requests.post(url, json=payload, timeout=5)
        data = response.json()
        results = data.get("results", [])
        if not results:
            return f"No recent news found for query: {query}."
        snippets = []
        for r in results:
            snippets.append(f"- {r.get('title')}: {r.get('content')}")
        return "Found the following search results:\n" + "\n".join(snippets)
    except Exception as e:
        return f"Error calling Tavily API: {e}"
