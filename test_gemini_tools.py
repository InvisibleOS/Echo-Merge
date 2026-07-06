import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv("services/ingestion/.env")

def search_mock(query: str) -> str:
    """Mock search tool."""
    return f"Result for {query}"

client = genai.Client(vertexai=True, project="playpen-fa38ad", location="us-central1")
chat = client.chats.create(
    model="gemini-1.5-flash",
    config=types.GenerateContentConfig(
        tools=[search_mock],
        temperature=0.1
    )
)
resp = chat.send_message("Please search for 'hello'")
print(resp.text)
