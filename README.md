# IntelliSphere: Domain-Specific RAG-Based Conversational AI System 🌐

A domain-specific AI-powered chatbot application that provides intelligent, contextual responses across multiple knowledge domains including Health, Law, Finance, Technology, Education, and Research.

## 🚀 Features

- **Multi-Domain Expertise**: Specialized knowledge bases for different domains
- **User Authentication**: Secure signup/login system with session management
- **Persistent Chat History**: Chat histories stored per user and domain
- **RAG Implementation**: Retrieval-Augmented Generation using FAISS vector databases
- **Responsive UI**: Clean, modern interface across all domain pages
- **Session Management**: Create, manage, and delete chat sessions

## 🏗️ Architecture

### Backend
- **Flask**: Web framework with session management
- **MongoDB**: User data and chat history storage
- **FAISS**: Vector search for document retrieval
- **LangChain**: Document processing and embeddings
- **Google Generative AI**: LLM for response generation

### Frontend
- **HTML/CSS/JavaScript**: Responsive web interface
- **Domain-specific pages**: Tailored UI for each knowledge domain

## 📁 Project Structure

```
intellisphere/
├── flaskapp.py                 # Main Flask application
├── static/                     # Static assets
│   ├── style.css              # Main stylesheet
│   ├── login.css              # Login page styles
│   ├── script.js              # Main JavaScript
│   └── validation.js          # Form validation
├── templates/                  # HTML templates
│   ├── home.html              # Home page
│   ├── login.html             # Login page
│   ├── signup.html            # Signup page
│   ├── health.html            # Health domain
│   ├── law.html               # Law domain
│   ├── finance.html           # Finance domain
│   ├── technology.html        # Technology domain
│   ├── education.html         # Education domain
│   └── research.html          # Research domain
├── faiss_indexes/             # Vector databases
│   ├── health/                # Health domain index
│   ├── law/                   # Law domain index
│   ├── finance/               # Finance domain index
│   ├── technology/            # Technology domain index
│   ├── education/             # Education domain index
│   ├── research/              # Research domain index
│   └── general/               # General/home domain index
└── requirements.txt           # Python dependencies
```

## 🛠️ Installation

### Prerequisites
- Python 3.8+
- MongoDB (local or cloud instance)
- Google AI API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd intellisphere
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/
   GOOGLE_API_KEY=your_google_ai_api_key_here
   ```

5. **Prepare FAISS Indexes**
   Ensure your FAISS vector databases are properly set up in the `faiss_indexes/` directory. Each domain folder should contain:
   - `index.faiss` - The FAISS index file
   - `index.pkl` - The metadata pickle file

6. **Run the application**
   ```bash
   python flaskapp.py
   ```

The application will be available at `http://localhost:5000`

## 🔧 Configuration

### Domain Mapping
The application supports the following domains:
- **Health**: Medical and healthcare information
- **Law**: Legal knowledge and advice
- **Finance**: Financial guidance and information
- **Technology**: Tech-related queries and solutions
- **Education**: Educational content and resources
- **Research**: Academic and research materials
- **Home/General**: Default domain for general queries

### MongoDB Collections
- `users`: User authentication data
- `chat_histories`: Per-user, per-domain chat histories
- `sessions`: Flask session data

## 🎯 Usage

1. **Sign Up/Login**: Create an account or log in with existing credentials
2. **Choose Domain**: Navigate to your desired knowledge domain
3. **Start Chatting**: Ask questions and receive AI-powered responses
4. **Session Management**: Create new sessions or continue previous conversations
5. **Cross-Domain**: Switch between different domains while maintaining separate chat histories

## 🔐 Security Features

- Password hashing using Werkzeug security
- Session-based authentication
- CORS enabled for cross-origin requests
- Secure session configuration with 31-day lifetime

## 📊 API Endpoints

### Authentication
- `POST /signup` - User registration
- `POST /login` - User login
- `POST /logout` - User logout

### Chat Functionality
- `POST /chat` - Send message and receive AI response
- `POST /create_new_session` - Create new chat session
- `POST /get_session_history` - Retrieve chat history
- `POST /delete_session` - Delete chat session

### Pages
- `GET /` - Login page
- `GET /home` - Home/general domain
- `GET /{domain}` - Domain-specific pages

## 🤖 AI Integration

The application uses:
- **HuggingFace Embeddings**: `all-MiniLM-L6-v2` for document embeddings
- **Google Generative AI**: `gemini-2.0-flash` for response generation
- **FAISS**: For efficient similarity search in vector space
- **LangChain**: For document processing and retrieval chains

## 🧪 Development

### Adding New Domains
1. Create FAISS index in `faiss_indexes/{domain}/`
2. Add domain to `DOMAIN_INDEXES` dictionary
3. Create HTML template in `templates/{domain}.html`
4. Add route in `flaskapp.py`

### Customizing Prompts
Modify the `strict_prompt` variable in the `/chat` route to adjust AI behavior and response format.

## 📝 Requirements

Key dependencies:
- Flask & Flask-CORS
- PyMongo & Flask-Session
- LangChain Community
- FAISS-CPU
- Google Generative AI
- HuggingFace Transformers
- Werkzeug

## 🐛 Troubleshooting

### Common Issues
1. **FAISS Index Not Found**: Ensure all domain indexes are properly created and placed in the correct directories
2. **MongoDB Connection**: Verify MongoDB is running and connection string is correct
3. **Google AI API**: Check API key is valid and properly set in environment variables
4. **Session Issues**: Clear browser cache and ensure MongoDB sessions collection is accessible

### Debug Mode
The application runs in debug mode by default. Disable for production:
```python
app.run(debug=False)
```

### Demo
Login and signup page : 
![WhatsApp Image 2025-06-24 at 20 53 38_ad2777b3](https://github.com/user-attachments/assets/6ff86727-994c-4506-83bf-3bc69ab3fe9d)

Home Page : 
![WhatsApp Image 2025-06-24 at 21 07 31_a32d61d6](https://github.com/user-attachments/assets/ce6533f9-5c4c-49cf-b229-8fab069204f1)

Law Page : 
![image](https://github.com/user-attachments/assets/648a14e7-910d-41b8-84db-55b2ff047d5c)
![image](https://github.com/user-attachments/assets/c48cf510-3fc3-4e56-831a-bce5c80f0a55)

Health Page : 
![image](https://github.com/user-attachments/assets/714481e5-41df-4e33-9587-90d7a4be1c6f)
![image](https://github.com/user-attachments/assets/21ccb9ca-916e-4dd4-a31e-d16fc7c959fc)

It wont answer the questions that are not related to health (I have passed the health data only)
![image](https://github.com/user-attachments/assets/c7d18f93-f697-4b2f-b5ca-0841130612be)

The other domains are in process :))
Stay Tuned!!













