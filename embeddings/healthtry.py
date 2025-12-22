import os
import pandas as pd
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

# Load environment variables (if needed)
load_dotenv()

# Define paths
CSV_FILE_PATH = "./data/health/medquad.csv"  # <-- Your CSV file
FAISS_INDEX_DIR = "./faiss_indexes/health/"  # Where FAISS indexes will be stored

def preprocess_csv_and_save_faiss():
    """Loads data from CSV, processes it, and saves FAISS index."""

    print("🚀 Starting FAISS creation from CSV...")

    # Use HuggingFace embeddings
    embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    print("✅ HuggingFace embedder loaded.")

    # Text splitter
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    print("✅ Text splitter initialized.")

    # Load CSV
    print(f"📂 Loading CSV from: {CSV_FILE_PATH}")
    df = pd.read_csv(CSV_FILE_PATH)

    print(f"✅ CSV loaded! Number of rows: {len(df)}")

    # Combine all columns into a single text per row
    print("🛠️ Combining columns into single text entries...")
    combined_texts = (
        df['question'].fillna('') + 
        ' [SEP] ' + df['answer'].fillna('') + 
        ' [SEP] ' + df['source'].fillna('') + 
        ' [SEP] ' + df['focus_area'].fillna('')
    ).tolist()

    # (Optional) Split large texts into smaller chunks
    print("✂️ Splitting text into chunks (if needed)...")
    all_texts = []
    for i, text in enumerate(combined_texts):
        chunks = text_splitter.split_text(text)
        all_texts.extend(chunks)
        if i % 100 == 0:
            print(f"➡️ Processed {i}/{len(combined_texts)} rows")

    if not all_texts:
        print("⚠️ No valid text found in the CSV!")
        return

    print(f"✅ Total chunks created: {len(all_texts)}")

    # Create FAISS index and save it
    print("🧠 Creating FAISS index...")
    vectorstore = FAISS.from_texts(all_texts, embedder)

    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_DIR)

    print(f"🎯 FAISS index successfully saved at {FAISS_INDEX_DIR}")

# Run the function
preprocess_csv_and_save_faiss()
print("🎉 Done! FAISS index is ready for use.")
