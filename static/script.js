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
    
        // Get sorted session IDs (newest first)
        const sessionIds = Object.keys(sessions).sort((a, b) => {
            return sessions[b].createdAt - sessions[a].createdAt;
        });
        
        // Display sessions with proper numbering
        sessionIds.forEach((sessionId, index) => {
            const sessionNumber = sessionIds.length - index; // Reverse numbering so newest is highest
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
                // Close all other dropdowns first
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
                // Close dropdown when clicking session
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
        
        // Clear chat immediately
        chatContainer.innerHTML = "";
        
        // Update current session
        currentSessionId = sessionId;
        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
        
        // Fetch and render history
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
                // Save to local storage
                let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
                sessions[newSessionId] = {
                    createdAt: Date.now()
                };
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                // Switch to new session
                currentSessionId = newSessionId;
                localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                
                // Clear chat
                chatContainer.innerHTML = "";
                
                // Reload session list
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
                // Remove from local storage
                let sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
                delete sessions[sessionId];
                localStorage.setItem(getSessionKey(), JSON.stringify(sessions));
                
                // If we deleted the current session
                if (currentSessionId === sessionId) {
                    chatContainer.innerHTML = "";
                    
                    // Get remaining sessions
                    const remainingSessions = Object.keys(sessions);
                    
                    if (remainingSessions.length > 0) {
                        // Load the newest remaining session
                        const sortedIds = remainingSessions.sort((a, b) => {
                            return sessions[b].createdAt - sessions[a].createdAt;
                        });
                        currentSessionId = sortedIds[0];
                        localStorage.setItem(`currentSessionId_${currentDomain}`, currentSessionId);
                        await fetchAndRenderChatHistory(currentSessionId);
                    } else {
                        // No sessions left, create a new one
                        await createNewSession();
                        // Exit early since createNewSession already updates UI
                        return;
                    }
                }
                
                // Reload session list
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
                
                if (typeof marked === 'undefined') {
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
            saveSessionToLocalStorage();
        } catch (error) {
            loadingIndicator.style.display = "none";
            console.error("Chat error:", error);
            chatContainer.innerHTML += `<div class="message ai-message error">❌ Error: ${error}</div>`;
        }
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            submitBtn.click();
        }
    });

    async function initializePage() {
        const sessions = JSON.parse(localStorage.getItem(getSessionKey())) || {};
        
        if (Object.keys(sessions).length === 0) {
            // No sessions exist, create first one
            await createNewSession();
        } else {
            // Check if current session exists
            if (!currentSessionId || !sessions[currentSessionId]) {
                // Load newest session
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
            
            // Load the current session history
            await fetchAndRenderChatHistory(currentSessionId);
        }
        
        loadSessions();
        highlightActiveSession();
    }

    initializePage();
    newSessionBtn.addEventListener("click", createNewSession);
});