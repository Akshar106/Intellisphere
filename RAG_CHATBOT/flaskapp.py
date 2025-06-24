import os
import json
import secrets
from datetime import timedelta
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from pymongo import MongoClient
from flask_session import Session
from langchain_community.vectorstores import FAISS
from werkzeug.security import check_password_hash, generate_password_hash
from bson.binary import Binary
from langchain_google_genai import GoogleGenerativeAIEmbeddings, GoogleGenerativeAI

load_dotenv()

# Initialize MongoDB client first
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["intellisphere6"]
users_collection = db["users"]
chat_history_collection = db["chat_histories"]

# Then initialize Flask app and configure it
app = Flask(__name__, static_folder="static")
CORS(app)
app.secret_key = secrets.token_hex(32)

# Set up session configuration
app.config["SESSION_TYPE"] = "mongodb"
app.config["SESSION_MONGODB"] = client
app.config["SESSION_MONGODB_DB"] = "intellisphere6"
app.config["SESSION_MONGODB_COLLECTION"] = "sessions"
app.config["SESSION_PERMANENT"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=31)
Session(app)

# def hash_password(password):
#     salt = bcrypt.gensalt()
#     return bcrypt.hashpw(password.encode("utf-8"), salt)

# def check_password(stored_hash, password):
#     return bcrypt.checkpw(password.encode("utf-8"), stored_hash)

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    firstname = data.get("firstname", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not firstname or not email or not password:
        return jsonify({"success": False, "message": "All fields are required."})

    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already exists!"})

    hashed_password = generate_password_hash(password)

    users_collection.insert_one({
        "firstname": firstname,
        "email": email,
        "password": hashed_password
    })

    return jsonify({"success": True, "message": "Signup successful!"})


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"success": False, "message": "Both email and password are required."})

        user = users_collection.find_one({"email": email})

        if user and check_password_hash(user["password"], password):
            session["user"] = email
            
            # No need to load all histories here, they'll be loaded when needed
            # based on domain access
            
            return jsonify({"success": True, "message": "Login successful!"})

        return jsonify({"success": False, "message": "Invalid email or password."})

    return render_template("login.html")

@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"message": "Logged out successfully!"})

DOMAIN_INDEXES = {
    "health": "faiss_indexes/health",
    "law": "faiss_indexes/law",
    "finance": "faiss_indexes/finance",
    "technology": "faiss_indexes/technology",
    "education": "faiss_indexes/education",
    "research": "faiss_indexes/research",
    "home": "faiss_indexes/general"  # Default domain
}

# Cache for loaded vector stores to avoid reloading
vectorstore_cache = {}

def load_vectorstore(domain):
    """Load the FAISS index for the specified domain using sentence transformers embedding model"""
    # Return from cache if already loaded
    if domain in vectorstore_cache:
        return vectorstore_cache[domain]
    
    # Get the path for the specified domain or use general as fallback
    index_path = DOMAIN_INDEXES.get(domain, DOMAIN_INDEXES["home"])
    abs_path = os.path.abspath(index_path)
    faiss_file = f"{index_path}/index.faiss"
    pkl_file = f"{index_path}/index.pkl"
    
    print(f"Looking for files at absolute path: {abs_path}")
    print(f"FAISS file exists: {os.path.exists(faiss_file)}")
    print(f"PKL file exists: {os.path.exists(pkl_file)}")
    
    try:
        # Use SentenceTransformers for all domains
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        # Check if index files exist
        if os.path.exists(f"{index_path}/index.faiss") and os.path.exists(f"{index_path}/index.pkl"):
            vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
            # Create a retriever with the embedding model
            # retriever = vectorstore.as_retriever()
            # Cache the retriever instead of the vectorstore
            vectorstore_cache[domain] = vectorstore
            print(f"✅ Loaded FAISS index for domain: {domain} using sentence_transformers embeddings")
            return vectorstore
        else:
            print(f"❌ No FAISS index found for domain: {domain} at path: {index_path}")
            return None
    except Exception as e:
        print(f"❌ Error loading vectorstore for domain {domain}: {str(e)}")
        return None

def get_domain_from_request():
    """Extract the domain from the request"""
    # First try to get from JSON request data
    if request.is_json:
        data = request.json
        if data and "domain" in data:
            domain = data.get("domain")
            if domain in DOMAIN_INDEXES:
                return domain
    
    # Then try to get from URL path or referrer
    path = request.referrer if request.referrer else request.path
    for domain in DOMAIN_INDEXES:
        if f"/{domain}" in path:
            return domain
    
    # Default to home if no domain found
    return "home"

@app.route("/chat", methods=["POST"])
def chat():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    query = data.get("query", "")
    
    # Get domain information
    raw_referrer = request.headers.get('Referer', '')
    domain = "home"
    
    for domain_name in DOMAIN_INDEXES.keys():
        if f"/{domain_name}" in raw_referrer:
            domain = domain_name
            break
    
    # Load the appropriate retriever for this domain
    retriever = load_vectorstore(domain)
    if not retriever:
        return jsonify({"error": f"FAISS index not loaded for domain: {domain}!"})

    try:
        # Use the retriever directly
        relevant_docs = retriever.similarity_search(query)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])

        # Get user's chat history for this domain from database
        history_filter = {
            "user_email": user_email,
            "domain": domain
        }
        
        user_history = chat_history_collection.find_one(history_filter)
        
        if not user_history:
            history = []
        else:
            history = user_history.get("messages", [])
        
        # Use only the last 5 messages for context
        recent_history = history[-5:] if len(history) > 5 else history
        conversation_context = "\n".join([f"User: {h['user']}\nBot: {h['bot']}" for h in recent_history])
        
        # Your existing prompt code
        strict_prompt = f"""
        You are IntelliSphere, an expert AI assistant specializing in {domain.capitalize()} knowledge. 
        Your mission is to provide insightful, accurate, and comprehensive answers using domain-specific expertise.

        ---

        📚 CONTEXT GUIDELINES
        Base all responses exclusively on the following verified documents:
        {context}

        🧠 CONVERSATION HISTORY
        Maintain conversational flow by considering:
        {conversation_context}

        ❓ NEW QUESTION
        Address the following query:
        {query}

        ---

        🔍 RESPONSE INSTRUCTIONS
        Always follow this structure:

        1. Begin with a warm, professional greeting that acknowledges the user's specific question.
        2. Provide a thorough, structured answer based on the context:
        - Break down complex concepts into simple explanations.
        - Include examples, figures, or data points if available.
        - Naturally insert emojis where appropriate to enhance clarity, friendliness, or emphasis (e.g., ✅, 📈, 💡, 🤔, etc.).
        3. Maintain a confident yet conversational tone, like speaking to a respected colleague.
        4. Organize longer answers with headings, bullet points, or numbered lists for easy reading.
        5. End with a brief summary and warmly invite follow-up questions.

        ---

        🚨 IMPORTANT
        If the provided context is insufficient to fully answer the question, respond:

        "Based on the available {domain} information, I don't have enough specific data to properly answer your question about [topic]. Would you like me to help with a related aspect I can address, or clarify your question?"

        ---

        🎯 GOAL
        Deliver expertise with clarity, warmth, and a human touch — **be insightful, precise, and approachable**, enhancing engagement through selective emoji use when it adds value to understanding or tone.
        """
        
        llm = GoogleGenerativeAI(model="gemini-2.0-flash")
        response = llm.invoke(strict_prompt)
        
        # Add the new message to history
        new_message = {"user": query, "bot": response}
        history.append(new_message)
        
        # Update or insert the chat history in the database
        chat_history_collection.update_one(
            history_filter,
            {"$set": {"messages": history}},
            upsert=True
        )
        
        # For the current session, also keep the history
        history_key = f"chat_history_{domain}"
        session[history_key] = history
        session.modified = True
        
        return jsonify({"history": history})
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        return jsonify({"error": f"Error processing query: {str(e)}"}), 500

@app.route("/create_new_session", methods=["POST"])
def create_new_session():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    domain = get_domain_from_request()
    
    # Create a new unique session ID
    new_session_id = secrets.token_hex(8)
    
    # Update the database to mark this as a new session
    chat_history_collection.insert_one({
        "user_email": user_email,
        "domain": domain,
        "session_id": new_session_id,
        "messages": []
    })
    
    # Clear the session history
    history_key = f"chat_history_{domain}"
    session[history_key] = []
    session.modified = True
    
    return jsonify({"success": True, "session_id": new_session_id})

# Add route for retrieving session history
@app.route("/get_session_history", methods=["POST"])
def get_session_history():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    domain = get_domain_from_request()
    
    # Get user's chat history for this domain from database
    user_history = chat_history_collection.find_one({
        "user_email": user_email,
        "domain": domain
    })
    
    if not user_history:
        history = []
    else:
        history = user_history.get("messages", [])
    
    # Update session with the history from the database
    history_key = f"chat_history_{domain}"
    session[history_key] = history
    session.modified = True
    
    return jsonify({"history": history})

# Add route for deleting session
@app.route("/delete_session", methods=["POST"])
def delete_session():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    domain = get_domain_from_request()
    session_id = request.json.get("session_id")
    
    # Delete the session from the database
    if session_id:
        chat_history_collection.delete_one({
            "user_email": user_email,
            "domain": domain,
            "session_id": session_id
        })
    else:
        # If no session ID provided, clear all sessions for this user in this domain
        chat_history_collection.delete_many({
            "user_email": user_email,
            "domain": domain
        })
    
    # Clear the session history
    history_key = f"chat_history_{domain}"
    session[history_key] = []
    session.modified = True
    
    return jsonify({"success": True})

@app.route("/")
def login_page():
    return render_template("login.html")

@app.route("/signup")
def signup_page():
    return render_template("signup.html")

@app.route("/home")
def home():
    return render_template("home.html")

@app.route("/law")
def law():
    return render_template("law.html", domain = "law")

@app.route("/health")
def health():
    return render_template("health.html", domain = "health")

@app.route("/technology")
def technology():
    return render_template("technology.html", domain = "technology")

@app.route("/finance")
def finance():
    return render_template("finance.html", domain = "finance")

@app.route("/research")
def research():
    return render_template("research.html", domain = "research")

@app.route("/education")
def education():
    return render_template("education.html", domain = "education")

# Run Flask App
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
