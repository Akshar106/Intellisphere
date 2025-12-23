import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader, CSVLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_FOLDER = os.path.join(BASE_DIR, "data", "health")
FAISS_INDEX_DIR = os.path.join(BASE_DIR, "faiss_indexes", "new_health")

def preprocess_and_save_faiss():
    """
    Loads PDFs + CSVs, creates embeddings, and stores them
    in ONE FAISS index with metadata.
    """
    embedder = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    all_documents = []

    for root, _, files in os.walk(DATA_FOLDER):
        for file in files:
            file_path = os.path.join(root, file)

            if file.lower().endswith(".pdf"):
                print(f"📄 Processing PDF: {file_path}")
                loader = PyMuPDFLoader(file_path)
                docs = loader.load()

                for d in docs:
                    d.metadata["source"] = file_path
                    d.metadata["type"] = "pdf"

                chunks = text_splitter.split_documents(docs)
                all_documents.extend(chunks)

            elif file.lower().endswith(".csv"):
                print(f"📊 Processing CSV: {file_path}")
                loader = CSVLoader(
                    file_path,
                    encoding="utf-8"
                )
                docs = loader.load()

                for d in docs:
                    d.metadata["source"] = file_path
                    d.metadata["type"] = "csv"

                chunks = text_splitter.split_documents(docs)
                all_documents.extend(chunks)

    if not all_documents:
        print("⚠️ No PDFs or CSVs found!")
        return

    vectorstore = FAISS.from_documents(all_documents, embedder)

    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_DIR)

    print(f"✅ FAISS index saved at: {FAISS_INDEX_DIR}")
    print(f"📦 Total chunks indexed: {len(all_documents)}")

preprocess_and_save_faiss()
print("🎉 PDF + CSV embeddings stored in ONE FAISS index!")
