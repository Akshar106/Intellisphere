import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()

LAW_PDF_FOLDER = "./data/Law/" 
FAISS_INDEX_DIR = "./faiss_indexes/Law/"  

def preprocess_and_save_faiss():
    """Recursively loads Law PDFs from subfolders, processes them, and saves FAISS index."""

    embedder = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    all_texts = []
    doc_sources = [] 

    for root, _, files in os.walk(LAW_PDF_FOLDER):
        for pdf_file in files:
            if pdf_file.endswith(".pdf"):
                pdf_path = os.path.join(root, pdf_file)
                print(f"📄 Processing: {pdf_path}")

                loader = PyMuPDFLoader(pdf_path)
                docs = loader.load()
                chunk_docs = text_splitter.split_documents(docs)

                for doc in chunk_docs:
                    all_texts.append(doc.page_content)
                    doc_sources.append(pdf_path) 

    if not all_texts:
        print("⚠️ No valid PDFs found! Make sure the folder contains PDF files.")
        return

    vectorstore = FAISS.from_texts(all_texts, embedder)
    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_DIR)
    print(f"✅ FAISS index saved at {FAISS_INDEX_DIR}")

preprocess_and_save_faiss()
print("🎉 Law FAISS index has been created!")
