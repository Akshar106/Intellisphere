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
import time

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)
db = client["intellisphere6"]
users_collection = db["users"]
chat_history_collection = db["chat_histories"]

app = Flask(__name__, static_folder="static")
CORS(app)
app.secret_key = secrets.token_hex(32)

app.config["SESSION_TYPE"] = "mongodb"
app.config["SESSION_MONGODB"] = client
app.config["SESSION_MONGODB_DB"] = "intellisphere6"
app.config["SESSION_MONGODB_COLLECTION"] = "sessions"
app.config["SESSION_PERMANENT"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=31)
Session(app)

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
    "home": "faiss_indexes/general" 
}

vectorstore_cache = {}

def load_vectorstore(domain):
    """Load the FAISS index for the specified domain using sentence transformers embedding model"""
   
    if domain in vectorstore_cache:
        return vectorstore_cache[domain]
    
    index_path = DOMAIN_INDEXES.get(domain, DOMAIN_INDEXES["home"])
    abs_path = os.path.abspath(index_path)
    faiss_file = f"{index_path}/index.faiss"
    pkl_file = f"{index_path}/index.pkl"
    
    print(f"Looking for files at absolute path: {abs_path}")
    print(f"FAISS file exists: {os.path.exists(faiss_file)}")
    print(f"PKL file exists: {os.path.exists(pkl_file)}")
    
    try:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embedder = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        if os.path.exists(f"{index_path}/index.faiss") and os.path.exists(f"{index_path}/index.pkl"):
            vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
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
    if request.is_json:
        data = request.json
        if data and "domain" in data:
            domain = data.get("domain")
            if domain in DOMAIN_INDEXES:
                return domain
    
    path = request.referrer if request.referrer else request.path
    for domain in DOMAIN_INDEXES:
        if f"/{domain}" in path:
            return domain
    
    return "home"

@app.route("/chat", methods=["POST"])
def chat():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    query = data.get("query", "")
    session_id = data.get("session_id")
    
    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400
    
    raw_referrer = request.headers.get('Referer', '')
    domain = "home"
    
    for domain_name in DOMAIN_INDEXES.keys():
        if f"/{domain_name}" in raw_referrer:
            domain = domain_name
            break
    
    if data.get("domain"):
        domain = data.get("domain")
    
    print(f"Processing chat for user: {user_email}, domain: {domain}, session: {session_id}, query: {query}")
    
    retriever = load_vectorstore(domain)
    if not retriever:
        return jsonify({"error": f"FAISS index not loaded for domain: {domain}!"})

    try:
        history_filter = {
            "user_email": user_email,
            "domain": domain,
            "session_id": session_id
        }
        
        user_history = chat_history_collection.find_one(history_filter)
        
        if not user_history:
            chat_history_collection.insert_one({
                "user_email": user_email,
                "domain": domain,
                "session_id": session_id,
                "messages": [],
                "created_at": int(time.time())  
            })
            history = []
            print(f"Created new session record for {session_id}")
        else:
            history = user_history.get("messages", [])
            print(f"Found existing session {session_id} with {len(history)} messages")
        
        relevant_docs = retriever.similarity_search(query, k=3)  
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
        
        conversation_context = ""
        if len(history) > 0:
            recent_history = history[-2:] if len(history) > 2 else history
            conversation_parts = []
            for h in recent_history:
                conversation_parts.append(f"Previous User Question: {h['user']}")
                conversation_parts.append(f"Previous Assistant Response: {h['bot'][:200]}...")  # Truncate long responses
            conversation_context = "\n".join(conversation_parts)
        
        if conversation_context:
            context_section = f"""
🧠 SESSION CONTEXT (for continuity only):
{conversation_context}

⚠️ IMPORTANT: This is a NEW question. Provide a fresh, complete answer. Do not assume the user is continuing the exact same topic unless explicitly stated.
"""
        else:
            context_section = """
🧠 SESSION STATUS: This is the beginning of a new conversation session.
"""
        
        strict_prompt = f"""
You are IntelliSphere, an expert AI assistant specializing in {domain.capitalize()} knowledge.

---

📚 RELEVANT INFORMATION:
{context}

{context_section}

❓ CURRENT QUESTION:
{query}

---

🎯 RESPONSE GUIDELINES:

1. **Treat this as a fresh question** - provide a complete, standalone answer
2. **Use the relevant information above** to give accurate, detailed responses
3. **Be conversational and helpful** - include appropriate emojis for engagement
4. **Structure your response clearly** with headings, bullet points, or lists when helpful
5. **If you don't have enough information**, clearly state what you cannot answer

---

🚨 CRITICAL RULES:
- Each response should be complete and self-contained
- Only reference previous messages if the user explicitly asks about them
- Focus on answering the current question thoroughly
- Use the {domain} knowledge base provided above

---

Please provide a helpful, accurate response to the user's question:
"""
        
        llm = GoogleGenerativeAI(model="gemini-2.0-flash")
        response = llm.invoke(strict_prompt)
        
        new_message = {"user": query, "bot": response}
        history.append(new_message)
        
        # Update the chat history in the database
        update_result = chat_history_collection.update_one(
            history_filter,
            {"$set": {"messages": history, "last_updated": int(time.time())}},
            upsert=True
        )
        
        print(f"Updated session {session_id}: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
        return jsonify({"history": history})
        
    except Exception as e:
        print(f"Error processing query: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing query: {str(e)}"}), 500

@app.route("/create_new_session", methods=["POST"])
def create_new_session():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    domain = data.get("domain", "home")
    session_id = data.get("session_id")
    
    # If no session_id provided, create one
    if not session_id:
        session_id = secrets.token_hex(8)
    
    # Create a new session in the database
    chat_history_collection.insert_one({
        "user_email": user_email,
        "domain": domain,
        "session_id": session_id,
        "messages": [],
        "created_at": secrets.token_hex(8)  
    })
    
    return jsonify({"success": True, "session_id": session_id})

@app.route("/get_session_history", methods=["POST"])
def get_session_history():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    domain = data.get("domain", "home")
    session_id = data.get("session_id")
    
    user_history = chat_history_collection.find_one({
        "user_email": user_email,
        "domain": domain,
        "session_id": session_id 
    })
    
    if not user_history:
        history = []
    else:
        history = user_history.get("messages", [])
    
    return jsonify({"history": history})

@app.route("/delete_session", methods=["POST"])
def delete_session():
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    domain = data.get("domain", "home")
    session_id = data.get("session_id")
    
    # Delete the specific session from the database
    if session_id:
        result = chat_history_collection.delete_one({
            "user_email": user_email,
            "domain": domain,
            "session_id": session_id
        })
        print(f"Deleted {result.deleted_count} session(s) for user {user_email}, domain {domain}, session {session_id}")
    else:
        # If no session ID provided, clear all sessions for this user in this domain
        result = chat_history_collection.delete_many({
            "user_email": user_email,
            "domain": domain
        })
        print(f"Deleted {result.deleted_count} session(s) for user {user_email}, domain {domain}")
    
    return jsonify({"success": True})

@app.route("/get_all_sessions", methods=["POST"])
def get_all_sessions():
    """Get all sessions for a user in a specific domain"""
    if "user" not in session:
        return jsonify({"error": "Please log in to continue"}), 401
        
    user_email = session["user"]
    data = request.json
    domain = data.get("domain", "home")
    
    # Get all sessions for this user and domain
    sessions = chat_history_collection.find({
        "user_email": user_email,
        "domain": domain
    }, {"session_id": 1, "created_at": 1, "_id": 0})
    
    session_list = list(sessions)
    return jsonify({"sessions": session_list})

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

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
