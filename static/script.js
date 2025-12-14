// Global state
let apiKey = '';
let isLoading = false;

// DOM Elements
const apiModal = document.getElementById('apiModal');
const chatInterface = document.getElementById('chatInterface');
const apiKeyInput = document.getElementById('apiKeyInput');
const startChatBtn = document.getElementById('startChatBtn');
const changeApiKeyBtn = document.getElementById('changeApiKeyBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const healthStatus = document.getElementById('healthStatus');
const chunksCount = document.getElementById('chunksCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    setupEventListeners();
});

// Check backend health
async function checkHealth() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
            healthStatus.innerHTML = `✅ Knowledge base loaded: ${data.chunks_loaded} chunks`;
            healthStatus.style.background = '#f0fff4';
            healthStatus.style.borderColor = '#9ae6b4';
            healthStatus.style.color = '#22543d';
        }
    } catch (error) {
        healthStatus.innerHTML = '❌ Failed to connect to backend';
        healthStatus.style.background = '#fff5f5';
        healthStatus.style.borderColor = '#fc8181';
        healthStatus.style.color = '#c53030';
    }
}

// Setup event listeners
function setupEventListeners() {
    startChatBtn.addEventListener('click', handleStartChat);
    changeApiKeyBtn.addEventListener('click', handleChangeApiKey);
    sendBtn.addEventListener('click', handleSendMessage);
    
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleStartChat();
        }
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = !messageInput.value.trim() || isLoading;
    });
}

// Handle start chat
async function handleStartChat() {
    const key = apiKeyInput.value.trim();
    
    if (!key) {
        alert('Please enter your API key');
        return;
    }
    
    apiKey = key;
    apiModal.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    
    // Update chunks count
    try {
        const response = await fetch('/health');
        const data = await response.json();
        chunksCount.textContent = `${data.chunks_loaded} chunks loaded`;
    } catch (error) {
        chunksCount.textContent = 'Knowledge base loaded';
    }
    
    messageInput.focus();
}

// Handle change API key
function handleChangeApiKey() {
    chatInterface.classList.add('hidden');
    apiModal.classList.remove('hidden');
    apiKeyInput.value = '';
    apiKeyInput.focus();
}

// Handle send message
async function handleSendMessage() {
    const message = messageInput.value.trim();
    
    if (!message || isLoading) {
        return;
    }
    
    // Add user message
    addMessage(message, 'user');
    messageInput.value = '';
    
    // Show loading
    isLoading = true;
    sendBtn.disabled = true;
    const loadingId = addLoadingMessage();
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: message,
                api_key: apiKey,
                top_k: 3
            })
        });
        
        const data = await response.json();
        
        // Remove loading message
        removeLoadingMessage(loadingId);
        
        if (data.success) {
            addMessage(data.answer, 'assistant');
        } else {
            addErrorMessage(data.error || 'Failed to get response');
        }
    } catch (error) {
        removeLoadingMessage(loadingId);
        addErrorMessage('Network error: ' + error.message);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// Add message to chat
function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    scrollToBottom();
}

// Add loading message
function addLoadingMessage() {
    const loadingId = 'loading-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message';
    messageDiv.id = loadingId;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-message';
    contentDiv.innerHTML = `
        <span>Thinking</span>
        <div class="loading-dots">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
    `;
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    scrollToBottom();
    return loadingId;
}

// Remove loading message
function removeLoadingMessage(loadingId) {
    const loadingMsg = document.getElementById(loadingId);
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

// Add error message
function addErrorMessage(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>Error:</strong> ${error}`;
    
    messagesContainer.appendChild(errorDiv);
    scrollToBottom();
}

// Scroll to bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}