document.addEventListener("DOMContentLoaded", function () {
    const chatContainer = document.getElementById("chat-container");
    const userInput = document.getElementById("text-input");
    const submitBtn = document.getElementById("submit-btn");
    const loadingIndicator = document.getElementById("loading-indicator");
    const sessionList = document.getElementById("session-list");
    const newSessionBtn = document.getElementById("new-session-btn");
    
    let currentDomain = window.currentDomain;
    
    if (!currentDomain) {
        let pathSegments = window.location.pathname.split("/");
        pathSegments = pathSegments.filter(segment => segment.length > 0);
        currentDomain = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : "home";
        
        const validDomains = ["health", "law", "finance", "technology", "education", "research", "home"];
        if (!validDomains.includes(currentDomain)) {
            currentDomain = "home";
        }
    }
    
    console.log(`Current domain: ${currentDomain}`);

    function getSessionKey() {
        return `chatSessions_${currentDomain}`;
    }

    let currentSessionId = localStorage.getItem(`currentSessionId_${currentDomain}`) || null;

    // Load marked.js for markdown parsing
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);

    // ===== LOADING ANIMATION FUNCTIONS =====
    
    function showInlineLoading() {
        // Remove any existing loading indicator
        hideInlineLoading();
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-message';
        loadingDiv.id = 'inline-loading';
        loadingDiv.innerHTML = `
            <div class="typing-indicator">
                <span>Thinking</span>
                <div class="typing-dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideInlineLoading() {
        const loadingDiv = document.getElementById('inline-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    function toggleInputs(disabled) {
        submitBtn.disabled = disabled;
        userInput.disabled = disabled;
    }

    // ===== TEXT FORMATTING =====
    
    function formatText(text) {
        if (typeof marked !== 'undefined') {
            const parsedHTML = marked.parse(text);
            return `<div class="formatted-message">${parsedHTML}</div>`;
        }
        return text;
    }

    // ===== SESSION MANAGEMENT =====
    
    function loadSessions() {
        const sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        sessionList.innerHTML = "";
    
        // Get sorted session IDs (newest first)
        const sessionIds = Object.keys(sessions).sort((a, b) => {
            return sessions[b].createdAt - sessions[a].createdAt;
        });
        
        // Display sessions with proper numbering
        sessionIds.forEach((sessionId, index) => {
            const sessionNumber = sessionIds.length - index;
            const sessionName = `Session ${sessionNumber}`;
            const sessionItem = document.createElement("li");
            sessionItem.textContent = sessionName;
            sessionItem.dataset.sessionId = sessionId;
            sessionItem.classList.add("session-item");
            
            if (sessionId === currentSessionId) {
                sessionItem.classList.add("active-session");
            }

            const menuContainer = document.createElement("div");
            menuContainer.classList.add("menu-container");

            const menuButton = document.createElement("span");
            menuButton.textContent = "⋮"; 
            menuButton.classList.add("menu-button");

            const menuDropdown = document.createElement("div");
            menuDropdown.classList.add("menu-dropdown");
            menuDropdown.innerHTML = `<button class="delete-session">Delete</button>`;

            menuButton.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".menu-dropdown").forEach(dd => {
                    if (dd !== menuDropdown) dd.classList.remove("show");
                });
                menuDropdown.classList.toggle("show");
            });

            menuDropdown.querySelector(".delete-session").addEventListener("click", async (e) => {
                e.stopPropagation();
                menuDropdown.classList.remove("show");
                await deleteSession(sessionId);
            });

            menuContainer.appendChild(menuButton);
            menuContainer.appendChild(menuDropdown);
            sessionItem.appendChild(menuContainer);

            sessionItem.addEventListener("click", () => {
                document.querySelectorAll(".menu-dropdown").forEach(dd => dd.classList.remove("show"));
                loadSession(sessionId);
            });
            sessionList.appendChild(sessionItem);
        });

        // Close dropdowns when clicking outside
        document.addEventListener("click", (e) => {
            if (!e.target.closest('.menu-container')) {
                document.querySelectorAll(".menu-dropdown").forEach((dropdown) => dropdown.classList.remove("show"));
            }
        });
    }

    function loadSession(sessionId) {
        console.log(`Loading session: ${sessionId}`);
        
        chatContainer.innerHTML = "";
        currentSessionId = sessionId;
        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
        
        fetchAndRenderChatHistory(sessionId);
        highlightActiveSession();
    }

    function highlightActiveSession() {
        document.querySelectorAll(".session-item").forEach(session => session.classList.remove("active-session"));
        const activeSession = document.querySelector(`[data-session-id="${currentSessionId}"]`);
        if (activeSession) {
            activeSession.classList.add("active-session");
        }
    }

    async function fetchAndRenderChatHistory(sessionId) {
        // Show old loading indicator for history loading
        loadingIndicator.style.display = "block";
        
        try {
            const response = await fetch("/get_session_history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    session_id: sessionId,
                    domain: currentDomain
                }),
            });
            
            const data = await response.json();
            loadingIndicator.style.display = "none";
            
            if (data.history && data.history.length > 0) {
                renderMessages(data.history);
            } else {
                console.log(`Session ${sessionId} is empty`);
            }
        } catch (error) {
            loadingIndicator.style.display = "none";
            console.error("Error loading session:", error);
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error loading session: ${error.message}</div>`;
        }
    }
    
    function renderMessages(messages) {
        chatContainer.innerHTML = "";
        messages.forEach((message) => {
            if (message.user) {
                chatContainer.innerHTML += `<div class="message user-message"><p>${message.user}</p></div>`;
            }
            if (message.bot) {
                let formattedResponse = formatText(message.bot);
                chatContainer.innerHTML += `<div class="message ai-message"><p>${formattedResponse}</p></div>`;
            }
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function saveSessionToLocalStorage() {
        let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = {
                createdAt: Date.now()
            };
            localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
        }
    }

    async function createNewSession() {
        const newSessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        console.log(`Creating new session: ${newSessionId}`);
        
        try {
            const response = await fetch("/create_new_session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain: currentDomain,
                    session_id: newSessionId
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
                sessions[newSessionId] = {
                    createdAt: Date.now()
                };
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                currentSessionId = newSessionId;
                localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                
                chatContainer.innerHTML = "";
                
                loadSessions();
                highlightActiveSession();
                
                console.log(`Created new session: ${newSessionId}`);
                return true;
            } else {
                console.error("Failed to create session:", data);
                alert("Failed to create new session. Please try again.");
                return false;
            }
        } catch (error) {
            console.error("Error creating session:", error);
            alert("Error creating new session. Please try again.");
            return false;
        }
    }

    async function deleteSession(sessionId) {
        if (!confirm("Are you sure you want to delete this session?")) {
            return;
        }

        try {
            const response = await fetch("/delete_session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    session_id: sessionId,
                    domain: currentDomain
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
                delete sessions[sessionId];
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                if (currentSessionId === sessionId) {
                    chatContainer.innerHTML = "";
                    
                    const remainingSessions = Object.keys(sessions);
                    
                    if (remainingSessions.length > 0) {
                        const sortedIds = remainingSessions.sort((a, b) => {
                            return sessions[b].createdAt - sessions[a].createdAt;
                        });
                        currentSessionId = sortedIds[0];
                        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                        await fetchAndRenderChatHistory(currentSessionId);
                    } else {
                        await createNewSession();
                        return;
                    }
                }
                
                loadSessions();
                console.log(`Deleted session: ${sessionId}`);
            } else {
                alert("Failed to delete session. Please try again.");
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            alert("Error deleting session. Please try again.");
        }
    }

    // ===== CHAT SUBMISSION =====
    
    submitBtn.addEventListener("click", async function () {
        let query = userInput.value.trim();
        if (!query) return;
        
        // Ensure we have a session
        if (!currentSessionId) {
            await createNewSession();
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`Sending query to session: ${currentSessionId}`);

        // Display user message
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message';
        userMessageDiv.innerHTML = `<p>${query}</p>`;
        chatContainer.appendChild(userMessageDiv);
        
        userInput.value = "";
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Show inline loading animation and disable inputs
        showInlineLoading();
        toggleInputs(true);

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    query: query,
                    domain: currentDomain,
                    session_id: currentSessionId
                }),
            });

            const data = await response.json();
            
            // Hide loading animation
            hideInlineLoading();
            toggleInputs(false);

            if (data.error) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message ai-message error';
                errorDiv.innerHTML = `<p>❌ ${data.error}</p>`;
                chatContainer.appendChild(errorDiv);
            } else {
                const botResponse = data.history[data.history.length - 1].bot;
                
                // Wait for marked.js to load if necessary
                if (typeof marked === 'undefined') {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                let formattedResponse = formatText(botResponse);
                const aiMessageDiv = document.createElement('div');
                aiMessageDiv.className = 'message ai-message';
                aiMessageDiv.innerHTML = `<p>${formattedResponse}</p>`;
                chatContainer.appendChild(aiMessageDiv);
                
                saveSessionToLocalStorage();
            }
            
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
        } catch (error) {
            hideInlineLoading();
            toggleInputs(false);
            
            console.error("Chat error:", error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message ai-message error';
            errorDiv.innerHTML = `<p>❌ Error: ${error.message || 'Failed to send message'}</p>`;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter" && !userInput.disabled) {
            event.preventDefault();
            submitBtn.click();
        }
    });

    // ===== INITIALIZATION =====
    
    async function initializePage() {
        try {
            const response = await fetch("/get_user_sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.sessions && data.sessions[currentDomain]) {
                let localSessions = {};
                data.sessions[currentDomain].forEach(sess => {
                    localSessions[sess.session_id] = {
                        createdAt: sess.createdAt
                    };
                });
                localStorage.setItem(getSessionKey(), JSON.stringify(localSessions));
                
                console.log(`Synced ${Object.keys(localSessions).length} sessions from database`);
            }
        } catch (error) {
            console.error("Error fetching sessions from database:", error);
        }
        
        const sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        if (Object.keys(sessions).length === 0) {
            await createNewSession();
        } else {
            if (!currentSessionId || !sessions[currentSessionId]) {
                const sortedIds = Object.keys(sessions).sort((a, b) => {
                    return sessions[b].createdAt - sessions[a].createdAt;
                });
                
                if (sortedIds.length > 0) {
                    currentSessionId = sortedIds[0];
                    localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                } else {
                    await createNewSession();
                    return;
                }
            }
            
            await fetchAndRenderChatHistory(currentSessionId);
        }
        
        loadSessions();
        highlightActiveSession();
    }

    initializePage();
    newSessionBtn.addEventListener("click", createNewSession);
});