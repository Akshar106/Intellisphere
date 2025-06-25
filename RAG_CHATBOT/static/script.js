document.addEventListener("DOMContentLoaded", function () {
    const chatContainer = document.getElementById("chat-container");
    const userInput = document.getElementById("text-input");
    const submitBtn = document.getElementById("submit-btn");
    const loadingIndicator = document.getElementById("loading-indicator");
    const sessionList = document.getElementById("session-list");
    const newSessionBtn = document.getElementById("new-session-btn");
    
    let currentDomain = window.currentDomain;
    
    if (!currentDomain) {
        // Fallback to extracting from URL if not provided
        let pathSegments = window.location.pathname.split("/");
        pathSegments = pathSegments.filter(segment => segment.length > 0);
        currentDomain = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : "home";
        
        // Make sure the domain is one of our valid domains
        const validDomains = ["health", "law", "finance", "technology", "education", "research", "home"];
        if (!validDomains.includes(currentDomain)) {
            currentDomain = "home"; // Default to home if not valid
        }
    }
    
    console.log(`Current domain: ${currentDomain}`);

    function getSessionKey() {
        return `chatSessions_${currentDomain}`;
    }

    // Current session being viewed
    let currentSessionId = localStorage.getItem(`currentSessionId_${currentDomain}`) || null;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);

    function formatText(text) {
        const parsedHTML = marked.parse(text);
        return `<div class="formatted-message">${parsedHTML}</div>`;
    }

    function loadSessions() {
        const sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        sessionList.innerHTML = "";
    
        // Get sorted session IDs (either numeric or timestamp-based)
        const sessionIds = Object.keys(sessions).sort((a, b) => {
            // If using timestamps, sort newest first
            return sessions[b].createdAt - sessions[a].createdAt;
        });
        
        // Track session number for display purposes
        let sessionNumber = 1;
        
        sessionIds.forEach((sessionId) => {
            // Use friendly session name for display 
            const sessionName = `Session ${sessionNumber++}`;
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
                menuDropdown.classList.toggle("show");
            });

            menuDropdown.querySelector(".delete-session").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteSession(sessionId);
            });

            menuContainer.appendChild(menuButton);
            menuContainer.appendChild(menuDropdown);
            sessionItem.appendChild(menuContainer);

            sessionItem.addEventListener("click", () => loadSession(sessionId));
            sessionList.appendChild(sessionItem);
        });

        document.addEventListener("click", () => {
            document.querySelectorAll(".menu-dropdown").forEach((dropdown) => dropdown.classList.remove("show"));
        });
    }

    function loadSession(sessionId) {
        console.log(`Switching to session ID: ${sessionId} from previous ${currentSessionId}`);
        currentSessionId = sessionId;
        // Store current session ID in localStorage so it persists across refreshes
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
        chatContainer.innerHTML = "";
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
                // Empty session - show a welcome message or keep empty
                console.log(`Session ${sessionId} is empty - showing clean chat`);
            }
        } catch (error) {
            loadingIndicator.style.display = "none";
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error loading session: ${error}</div>`;
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

    function saveSession() {
        let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        // Ensure the session exists with metadata
        if (!sessions[currentSessionId]) {
            sessions[currentSessionId] = {
                createdAt: Date.now()
            };
        }
        
        localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
    }

    async function createNewSession() {
    // Generate a new session ID using timestamp + random component
        const newSessionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        console.log(`Creating new session: ${newSessionId} for domain: ${currentDomain}`);
        
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
                // Update local session tracking
                let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
                
                // Add the new session with metadata
                sessions[newSessionId] = {
                    createdAt: Date.now()
                };
                
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                // Switch to the new session
                currentSessionId = newSessionId;
                localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                
                // Clear the chat container for the new session
                chatContainer.innerHTML = "";
                
                // Update UI
                loadSessions();
                highlightActiveSession();
                
                console.log(`Successfully created new session: ${newSessionId}`);
                return true;
            } else {
                console.error("Failed to create new session:", data);
                return false;
            }
        } catch (error) {
            console.error("Error creating new session:", error);
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error creating new session: ${error}</div>`;
            return false;
        }
    }

    // Fixed loadSession function to ensure clean loading
    function loadSession(sessionId) {
        console.log(`Switching to session ID: ${sessionId} from previous ${currentSessionId}`);
        
        // Clear the chat container immediately
        chatContainer.innerHTML = "";
        
        currentSessionId = sessionId;
        // Store current session ID in localStorage so it persists across refreshes
        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
        
        // Load the session history
        fetchAndRenderChatHistory(sessionId);
        highlightActiveSession();
    }

    async function deleteSession(sessionId) {
        let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        // Tell the backend to delete this session
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
                // Remove from local storage
                delete sessions[sessionId];
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                // If we deleted the current session, find a new one to load or create one
                if (currentSessionId === sessionId) {
                    chatContainer.innerHTML = "";
                    
                    // Find a new session to load if available
                    if (Object.keys(sessions).length > 0) {
                        // Sort by created time and get the newest one
                        const sortedIds = Object.keys(sessions).sort((a, b) => {
                            return sessions[b].createdAt - sessions[a].createdAt;
                        });
                        
                        currentSessionId = sortedIds[0];
                        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                        loadSession(currentSessionId);
                    } else {
                        // No sessions left, create a new one
                        await createNewSession();
                    }
                }
                
                loadSessions();
                console.log(`Deleted session: ${sessionId}`);
            }
        } catch (error) {
            console.error("Error deleting session:", error);
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error deleting session: ${error}</div>`;
        }
    }

    submitBtn.addEventListener("click", async function () {
        let query = userInput.value.trim();
        if (!query) return;
        
        // Make sure we have a current session
        if (!currentSessionId) {
            await createNewSession();
            // Wait a bit to ensure session is created
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Log session ID for debugging
        console.log(`Sending query with session ID: ${currentSessionId}, domain: ${currentDomain}`);

        // Display user message right away
        chatContainer.innerHTML += `<div class="message user-message"><p>${query}</p></div>`;
        userInput.value = "";
        chatContainer.scrollTop = chatContainer.scrollHeight;
        loadingIndicator.style.display = "block";

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
            loadingIndicator.style.display = "none";

            if (data.error) {
                chatContainer.innerHTML += `<div class="message ai-message error">❌ ${data.error}</div>`;
            } else {
                const botResponse = data.history[data.history.length - 1].bot;
                
                // Ensure marked library is loaded before parsing
                if (typeof marked === 'undefined') {
                    // If marked isn't loaded yet, add a small delay and try again
                    setTimeout(() => {
                        let formattedResponse = formatText(botResponse);
                        chatContainer.innerHTML += `<div class="message ai-message"><p>${formattedResponse}</p></div>`;
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }, 100);
                } else {
                    let formattedResponse = formatText(botResponse);
                    chatContainer.innerHTML += `<div class="message ai-message"><p>${formattedResponse}</p></div>`;
                }
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
            saveSession();
        } catch (error) {
            loadingIndicator.style.display = "none";
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error: ${error}</div>`;
        }
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") submitBtn.click();
    });

    // On page load, initialize and load current session
    async function initializePage() {
        // Check if there are any sessions
        const sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        if (Object.keys(sessions).length === 0) {
            // No sessions, create one
            await createNewSession();
        } else {
            // Check if the current session ID exists
            if (!currentSessionId || !sessions[currentSessionId]) {
                // Current session doesn't exist, use the newest one
                const sortedIds = Object.keys(sessions).sort((a, b) => {
                    return sessions[b].createdAt - sessions[a].createdAt;
                });
                
                if (sortedIds.length > 0) {
                    currentSessionId = sortedIds[0];
                    localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                } else {
                    // No valid sessions, create a new one
                    await createNewSession();
                    return; // Exit early since createNewSession will handle the rest
                }
            }
            
            // Load current session
            fetchAndRenderChatHistory(currentSessionId);
        }
        
        loadSessions();
        highlightActiveSession();
    }

    initializePage();
    newSessionBtn.addEventListener("click", createNewSession);
});
