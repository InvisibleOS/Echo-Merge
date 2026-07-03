import sys
import os
import hashlib
import numpy as np

# Add parent directory to path so we can import DBClient
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient

# Category base vectors to simulate semantic clustering in mock mode
# We define a few fixed 768-dim orthogonal base vectors for our mock categories
MOCK_CATEGORIES = [
    "Mobility - Roads, Footpaths and Infrastructure",
    "Garbage and Unsanitary Practices",
    "Traffic and Road Safety",
    "Streetlights",
    "Water Supply and Services",
    "Animal Husbandry",
    "Yellow Spot",
    "Crime and Safety",
    "Sanitation",
    "Pollution"
]

# Generate static orthogonal base vectors of dimension 768 for each mock category
np.random.seed(42)
CATEGORY_BASES = {
    cat: np.random.randn(768) for cat in MOCK_CATEGORIES
}
# Normalize bases
for cat in CATEGORY_BASES:
    norm = np.linalg.norm(CATEGORY_BASES[cat])
    if norm > 0:
        CATEGORY_BASES[cat] /= norm

# Global fallback base for unknown categories
DEFAULT_BASE = np.random.randn(768)
DEFAULT_BASE /= np.linalg.norm(DEFAULT_BASE)

class EmbeddingPipeline:
    def __init__(self, db_client: DBClient):
        self.db = db_client
        self.use_vertex = False
        
        # Try to initialize Vertex AI
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("ANTIGRAVITY_PROJECT_ID")
        if project_id and project_id != "outside-of-project":
            try:
                import vertexai
                from vertexai.language_models import TextEmbeddingModel
                vertexai.init(project=project_id, location="us-central1")
                self.model = TextEmbeddingModel.from_pretrained("text-embedding-004")
                self.use_vertex = True
                print("🧠 Vertex AI Text Embedding Model initialized successfully.")
            except Exception as e:
                print(f"⚠️ Failed to init Vertex AI ({e}). Using deterministic mock embedding pipeline.")
        else:
            print("ℹ️ Google Cloud Project not configured. Using deterministic mock embedding pipeline.")

    def get_embedding(self, text: str, category: str = None) -> np.ndarray:
        """Generates a 768-dimension embedding vector for the text."""
        if self.use_vertex:
            try:
                from vertexai.language_models import TextEmbeddingInput
                text_input = TextEmbeddingInput(text=text, task_type="RETRIEVAL_DOCUMENT")
                embeddings = self.model.get_embeddings([text_input])
                return np.array(embeddings[0].values, dtype=np.float32)
            except Exception as e:
                print(f"⚠️ Vertex AI embedding generation failed ({e}). Falling back to mock generator.")

        # Deterministic Mock Embedding Generator
        # Base vector based on the category
        base_vec = CATEGORY_BASES.get(category, DEFAULT_BASE).copy()
        
        # Generate deterministic noise based on the hash of the text
        # This ensures that identical texts have identical embeddings,
        # and similar texts (within same category) cluster closely together,
        # while different categories remain mostly orthogonal.
        hash_digest = hashlib.sha256(text.encode('utf-8')).digest()
        np.random.seed(int.from_bytes(hash_digest[:4], byteorder='big'))
        noise = np.random.randn(768)
        noise_norm = np.linalg.norm(noise)
        if noise_norm > 0:
            noise = (noise / noise_norm) * 0.15
        
        vector = base_vec + noise
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector /= norm
            
        return vector.astype(np.float32)

    def process_and_store_submission(self, sub: dict):
        """Generates embedding for a submission and stores both submission and embedding in DB."""
        # 1. Store submission text/metadata
        self.db.insert_submission(sub)
        
        # 2. Generate embedding for the English translation
        text_to_embed = sub.get("normalized_text_en", sub.get("raw_text", ""))
        category = sub.get("category")
        
        embedding = self.get_embedding(text_to_embed, category)
        
        # 3. Store embedding vector
        self.db.insert_embedding(sub["id"], embedding)

if __name__ == "__main__":
    db = DBClient()
    pipeline = EmbeddingPipeline(db)
    # Test generation
    emb = pipeline.get_embedding("Potholes on the main road in HSR Layout", "Mobility - Roads, Footpaths and Infrastructure")
    print(f"Test embedding generated successfully. Shape: {emb.shape}, Norm: {np.linalg.norm(emb):.4f}")
