import os
from langchain_community.document_loaders import PyMuPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

# Paths
HEALTHCARE_PDF_FOLDER = "./data/healthcare_pdfs/"
FAISS_INDEX_DIR = "./faiss_indexes/healthcare/"

def preprocess_and_save_faiss():
    """Loads healthcare PDFs, processes them, and saves FAISS index."""
    embedder = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    all_texts = []
    
    for pdf_file in os.listdir(HEALTHCARE_PDF_FOLDER):
        if pdf_file.endswith(".pdf"):
            pdf_path = os.path.join(HEALTHCARE_PDF_FOLDER, pdf_file)
            print(f"📄 Processing: {pdf_file}")
            
            loader = PyMuPDFLoader(pdf_path)
            docs = loader.load()
            chunk_docs = text_splitter.split_documents(docs)
            all_texts.extend([doc.page_content for doc in chunk_docs])

    if not all_texts:
        print("⚠️ No valid PDFs found! Make sure the folder contains PDF files.")
        return

    # Create FAISS index and save it
    vectorstore = FAISS.from_texts(all_texts, embedder)
    os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_DIR)
    print(f"✅ FAISS index saved at {FAISS_INDEX_DIR}")

# Run the function
preprocess_and_save_faiss()
print("🎉 Healthcare FAISS index has been created!")
