import os
import pandas as pd
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document

load_dotenv()

# Define paths
CSV_FOLDER = r"C:\Users\rd\OneDrive\Desktop\RAG\data\finance\data" 
FAISS_INDEX_DIR = "./faiss_indexes/finance/"  

def preprocess_csv_and_save_faiss():
    """Recursively loads CSV files from subfolders, processes them, and saves FAISS index."""
    
    embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    all_texts = []
    
    for root, _, files in os.walk(CSV_FOLDER):
        for file in files:
            if file.endswith(".csv"):
                csv_path = os.path.join(root, file)
                print(f"📊 Processing: {csv_path}")
                
                try:
                    df = pd.read_csv(csv_path, dtype=str)  
                    df.fillna("", inplace=True)
                    
                    row_texts = df.apply(lambda row: " | ".join(row.astype(str)), axis=1).tolist()
                    docs = [Document(page_content=row, metadata={"source": csv_path}) for row in row_texts]
                    chunked_docs = text_splitter.split_documents(docs)

                    for doc in chunked_docs:
                        all_texts.append(doc.page_content)
                
                except Exception as e:
                    print(f"❌ Error reading {csv_path}: {e}")

    if not all_texts:
        print("⚠️ No valid CSV data found!")
        return
    vectorstore = FAISS.from_texts(all_texts, embedder)
    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_DIR)
    print(f"✅ FAISS index saved at {FAISS_INDEX_DIR}")

preprocess_csv_and_save_faiss()
print("🎉 Finance CSV FAISS index has been created!")
