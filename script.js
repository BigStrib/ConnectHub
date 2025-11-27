// ==========================================
// CONNECTHUB - WEBRTC VIDEO CHAT APPLICATION
// ==========================================

class ConnectHub {
    constructor() {
        // State
        this.peer = null;
        this.connections = new Map(); // Store multiple potential connections
        this.activeConnection = null;
        this.activeCall = null;
        this.localStream = null;
        this.screenStream = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.userName = '';
        this.remoteName = '';
        this.roomCode = '';
        this.isChatOpen = true;
        this.isHost = false;
        this.connectionAttempts = 0;
        this.maxAttempts = 3;

        // DOM Elements
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            setupScreen: document.getElementById('setupScreen'),
            callScreen: document.getElementById('callScreen'),
            localPreview: document.getElementById('localPreview'),
            previewPlaceholder: document.getElementById('previewPlaceholder'),
            togglePreviewVideo: document.getElementById('togglePreviewVideo'),
            togglePreviewAudio: document.getElementById('togglePreviewAudio'),
            displayName: document.getElementById('displayName'),
            roomCode: document.getElementById('roomCode'),
            generateCode: document.getElementById('generateCode'),
            copyCode: document.getElementById('copyCode'),
            joinRoom: document.getElementById('joinRoom'),
            remoteVideo: document.getElementById('remoteVideo'),
            remotePlaceholder: document.getElementById('remotePlaceholder'),
            remoteName: document.getElementById('remoteName'),
            localVideo: document.getElementById('localVideo'),
            localPlaceholder: document.getElementById('localPlaceholder'),
            currentRoomCode: document.getElementById('currentRoomCode'),
            copyCurrentCode: document.getElementById('copyCurrentCode'),
            chatPanel: document.getElementById('chatPanel'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendMessage: document.getElementById('sendMessage'),
            toggleChat: document.getElementById('toggleChat'),
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            toggleScreenShare: document.getElementById('toggleScreenShare'),
            endCall: document.getElementById('endCall'),
            toastContainer: document.getElementById('toastContainer')
        };

        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    init() {
        this.bindEvents();
        this.initializeMedia();
    }

    bindEvents() {
        // Preview controls
        this.elements.togglePreviewVideo.addEventListener('click', () => this.togglePreviewVideo());
        this.elements.togglePreviewAudio.addEventListener('click', () => this.togglePreviewAudio());
        
        // Setup form
        this.elements.generateCode.addEventListener('click', () => this.generateRoomCode());
        this.elements.copyCode.addEventListener('click', () => this.copyRoomCode());
        this.elements.joinRoom.addEventListener('click', () => this.joinRoom());
        
        this.elements.roomCode.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.elements.displayName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Call controls
        this.elements.toggleVideo.addEventListener('click', () => this.toggleVideo());
        this.elements.toggleAudio.addEventListener('click', () => this.toggleAudio());
        this.elements.toggleScreenShare.addEventListener('click', () => this.toggleScreenShare());
        this.elements.endCall.addEventListener('click', () => this.endCall());
        this.elements.copyCurrentCode.addEventListener('click', () => this.copyCurrentRoomCode());
        
        // Chat
        this.elements.toggleChat.addEventListener('click', () => this.toggleChatPanel());
        this.elements.sendMessage.addEventListener('click', () => this.sendChatMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Handle page unload
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // ==========================================
    // MEDIA HANDLING
    // ==========================================
    
    async initializeMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.elements.localPreview.srcObject = this.localStream;
            this.elements.previewPlaceholder.classList.add('hidden');
            this.showToast('Camera and microphone ready', 'success');
            
        } catch (error) {
            console.error('Media access error:', error);
            
            // Try audio only
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true
                });
                this.isVideoEnabled = false;
                this.showToast('Audio only - camera not available', 'info');
            } catch (audioError) {
                this.showToast('Could not access camera/microphone. Please check permissions.', 'error');
                this.isVideoEnabled = false;
                this.isAudioEnabled = false;
            }
        }
    }

    togglePreviewVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTrack.enabled = this.isVideoEnabled;
            this.elements.togglePreviewVideo.classList.toggle('active', this.isVideoEnabled);
            this.elements.previewPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
    }

    togglePreviewAudio() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = !this.isAudioEnabled;
            audioTrack.enabled = this.isAudioEnabled;
            this.elements.togglePreviewAudio.classList.toggle('active', this.isAudioEnabled);
        }
    }

    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTrack.enabled = this.isVideoEnabled;
            
            this.elements.toggleVideo.dataset.active = this.isVideoEnabled;
            this.elements.toggleVideo.querySelector('i').className = 
                this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            this.elements.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
    }

    toggleAudio() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = !this.isAudioEnabled;
            audioTrack.enabled = this.isAudioEnabled;
            
            this.elements.toggleAudio.dataset.active = this.isAudioEnabled;
            this.elements.toggleAudio.querySelector('i').className = 
                this.isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        }
    }

    async toggleScreenShare() {
        if (this.isScreenSharing) {
            await this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }

    async startScreenShare() {
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });
            
            const screenTrack = this.screenStream.getVideoTracks()[0];
            
            // Replace video track in peer connection
            if (this.activeCall && this.activeCall.peerConnection) {
                const sender = this.activeCall.peerConnection.getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }
            
            this.elements.localVideo.srcObject = this.screenStream;
            
            screenTrack.onended = () => this.stopScreenShare();
            
            this.isScreenSharing = true;
            this.elements.toggleScreenShare.classList.add('active-share');
            this.showToast('Screen sharing started', 'success');
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Screen share error:', error);
                this.showToast('Could not share screen', 'error');
            }
        }
    }

    async stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        // Restore camera
        if (this.activeCall && this.activeCall.peerConnection && this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                const sender = this.activeCall.peerConnection.getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            }
        }
        
        this.elements.localVideo.srcObject = this.localStream;
        this.isScreenSharing = false;
        this.elements.toggleScreenShare.classList.remove('active-share');
    }

    // ==========================================
    // ROOM CODE MANAGEMENT
    // ==========================================
    
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.elements.roomCode.value = code;
        this.showToast('Room code generated! Share this code.', 'success');
    }

    copyRoomCode() {
        const code = this.elements.roomCode.value.trim();
        if (!code) {
            this.showToast('Generate a code first', 'error');
            return;
        }
        this.copyToClipboard(code);
    }

    copyCurrentRoomCode() {
        this.copyToClipboard(this.roomCode);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Copied to clipboard!', 'success');
        }
    }

    // ==========================================
    // PEER CONNECTION - FIXED LOGIC
    // ==========================================
    
    async joinRoom() {
        const name = this.elements.displayName.value.trim();
        const code = this.elements.roomCode.value.trim().toUpperCase();
        
        if (!name) {
            this.showToast('Please enter your name', 'error');
            this.elements.displayName.focus();
            return;
        }
        
        if (!code || code.length < 4) {
            this.showToast('Please enter a valid room code (at least 4 characters)', 'error');
            this.elements.roomCode.focus();
            return;
        }
        
        this.userName = name;
        this.roomCode = code;
        
        // Disable join button to prevent double-clicks
        this.elements.joinRoom.disabled = true;
        this.elements.joinRoom.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            await this.initializePeerConnection();
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showToast('Connection failed. Please try again.', 'error');
            this.updateConnectionStatus('offline', 'Disconnected');
            this.resetJoinButton();
        }
    }

    resetJoinButton() {
        this.elements.joinRoom.disabled = false;
        this.elements.joinRoom.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Room';
    }

    async initializePeerConnection() {
        // Clean up any existing connection
        this.cleanup();
        
        // The KEY FIX: Use deterministic peer IDs based on room code
        // First person to join becomes "host", second becomes "guest"
        const hostId = `room-${this.roomCode}-host`;
        const guestId = `room-${this.roomCode}-guest`;
        
        // Try to be the host first
        console.log('Attempting to create room as host...');
        
        try {
            await this.tryAsHost(hostId, guestId);
        } catch (error) {
            console.log('Host ID taken, joining as guest...');
            await this.tryAsGuest(guestId, hostId);
        }
    }

    tryAsHost(hostId, guestId) {
        return new Promise((resolve, reject) => {
            this.isHost = true;
            
            this.peer = new Peer(hostId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);
            
            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('Connected as HOST with ID:', id);
                
                this.showCallScreen();
                this.updateConnectionStatus('online', 'Waiting for guest...');
                this.showToast('Room created! Share code: ' + this.roomCode, 'success');
                
                // Set up listeners for incoming connections
                this.setupPeerListeners();
                
                resolve(id);
            });
            
            this.peer.on('error', (error) => {
                clearTimeout(timeout);
                console.log('Host error:', error.type);
                
                if (error.type === 'unavailable-id') {
                    // Host ID is taken, we need to join as guest
                    this.peer.destroy();
                    reject(error);
                } else if (error.type === 'peer-unavailable') {
                    // This is okay for host - no one to connect to yet
                    console.log('Waiting for guest to join...');
                } else {
                    reject(error);
                }
            });
        });
    }

    tryAsGuest(guestId, hostId) {
        return new Promise((resolve, reject) => {
            this.isHost = false;
            
            this.peer = new Peer(guestId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 15000);
            
            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('Connected as GUEST with ID:', id);
                
                this.showCallScreen();
                this.updateConnectionStatus('online', 'Connecting to host...');
                
                // Set up listeners
                this.setupPeerListeners();
                
                // Connect to the host
                setTimeout(() => {
                    this.connectToHost(hostId);
                }, 500);
                
                resolve(id);
            });
            
            this.peer.on('error', (error) => {
                clearTimeout(timeout);
                console.error('Guest error:', error);
                
                if (error.type === 'unavailable-id') {
                    this.showToast('Room is full. Please try a different code.', 'error');
                    this.showSetupScreen();
                    this.resetJoinButton();
                } else if (error.type === 'peer-unavailable') {
                    this.showToast('Host not found. Make sure they joined first.', 'error');
                    this.updateConnectionStatus('online', 'Host not found');
                }
                
                reject(error);
            });
        });
    }

    setupPeerListeners() {
        // Handle incoming data connections
        this.peer.on('connection', (conn) => {
            console.log('Incoming data connection from:', conn.peer);
            this.handleDataConnection(conn);
        });
        
        // Handle incoming calls
        this.peer.on('call', (call) => {
            console.log('Incoming call from:', call.peer);
            this.handleIncomingCall(call);
        });
        
        // Handle disconnection
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected from server');
            this.updateConnectionStatus('connecting', 'Reconnecting...');
            
            // Try to reconnect
            setTimeout(() => {
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            }, 1000);
        });
        
        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.updateConnectionStatus('offline', 'Disconnected');
        });
    }

    connectToHost(hostId) {
        console.log('Connecting to host:', hostId);
        
        // Create data connection
        const conn = this.peer.connect(hostId, {
            reliable: true,
            metadata: { name: this.userName }
        });
        
        this.handleDataConnection(conn);
        
        // Create media call after a short delay
        setTimeout(() => {
            if (this.localStream) {
                console.log('Calling host with media stream...');
                const call = this.peer.call(hostId, this.localStream, {
                    metadata: { name: this.userName }
                });
                this.handleOutgoingCall(call);
            } else {
                console.warn('No local stream available for call');
            }
        }, 1000);
    }

    handleDataConnection(conn) {
        console.log('Setting up data connection with:', conn.peer);
        
        conn.on('open', () => {
            console.log('Data connection OPEN with:', conn.peer);
            
            this.activeConnection = conn;
            this.remoteName = conn.metadata?.name || 'Participant';
            
            this.updateConnectionStatus('online', 'Connected');
            this.showRemoteName();
            this.showToast(`${this.remoteName} connected!`, 'success');
            
            // Send our name
            conn.send({
                type: 'identity',
                name: this.userName
            });
        });
        
        conn.on('data', (data) => {
            console.log('Received data:', data);
            this.handleDataMessage(data);
        });
        
        conn.on('close', () => {
            console.log('Data connection closed');
            if (this.activeConnection === conn) {
                this.handlePeerDisconnect();
            }
        });
        
        conn.on('error', (error) => {
            console.error('Data connection error:', error);
        });
    }

    handleIncomingCall(call) {
        console.log('Answering incoming call...');
        
        this.remoteName = call.metadata?.name || 'Participant';
        this.showRemoteName();
        
        // Answer with our stream
        call.answer(this.localStream);
        
        this.handleCallStream(call);
    }

    handleOutgoingCall(call) {
        console.log('Handling outgoing call...');
        this.handleCallStream(call);
    }

    handleCallStream(call) {
        this.activeCall = call;
        
        call.on('stream', (remoteStream) => {
            console.log('Received remote stream!');
            console.log('Remote stream tracks:', remoteStream.getTracks());
            
            this.elements.remoteVideo.srcObject = remoteStream;
            this.elements.remotePlaceholder.classList.add('hidden');
            
            this.updateConnectionStatus('online', 'In call');
            this.showToast('Video connected!', 'success');
        });
        
        call.on('close', () => {
            console.log('Call closed');
            this.handlePeerDisconnect();
        });
        
        call.on('error', (error) => {
            console.error('Call error:', error);
            this.showToast('Call error: ' + error.message, 'error');
        });
    }

    handleDataMessage(data) {
        switch (data.type) {
            case 'identity':
                this.remoteName = data.name;
                this.showRemoteName();
                break;
            case 'chat':
                this.displayMessage(data.name, data.message, false);
                break;
            default:
                console.log('Unknown message type:', data);
        }
    }

    handlePeerDisconnect() {
        console.log('Peer disconnected');
        
        this.showToast('Participant disconnected', 'info');
        this.elements.remoteVideo.srcObject = null;
        this.elements.remotePlaceholder.classList.remove('hidden');
        this.elements.remoteName.classList.remove('visible');
        
        this.remoteName = '';
        this.activeConnection = null;
        this.activeCall = null;
        
        if (this.isHost) {
            this.updateConnectionStatus('online', 'Waiting for guest...');
        } else {
            this.updateConnectionStatus('online', 'Host disconnected');
        }
    }

    showRemoteName() {
        if (this.remoteName) {
            this.elements.remoteName.textContent = this.remoteName;
            this.elements.remoteName.classList.add('visible');
        }
    }

    // ==========================================
    // UI MANAGEMENT
    // ==========================================
    
    showCallScreen() {
        this.elements.setupScreen.classList.add('hidden');
        this.elements.callScreen.classList.remove('hidden');
        this.elements.currentRoomCode.textContent = this.roomCode;
        
        if (this.localStream) {
            this.elements.localVideo.srcObject = this.localStream;
            this.elements.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
        
        this.resetJoinButton();
    }

    showSetupScreen() {
        this.elements.callScreen.classList.add('hidden');
        this.elements.setupScreen.classList.remove('hidden');
    }

    updateConnectionStatus(status, text) {
        const dot = this.elements.connectionStatus.querySelector('.status-dot');
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        
        dot.className = 'status-dot ' + status;
        statusText.textContent = text;
    }

    toggleChatPanel() {
        this.isChatOpen = !this.isChatOpen;
        this.elements.chatPanel.classList.toggle('collapsed', !this.isChatOpen);
        
        const icon = this.elements.toggleChat.querySelector('i');
        icon.className = this.isChatOpen ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }

    // ==========================================
    // CHAT FUNCTIONALITY
    // ==========================================
    
    sendChatMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message) return;
        
        if (!this.activeConnection || !this.activeConnection.open) {
            this.showToast('Not connected to anyone yet', 'error');
            return;
        }
        
        // Send message
        this.activeConnection.send({
            type: 'chat',
            name: this.userName,
            message: message
        });
        
        // Display own message
        this.displayMessage(this.userName, message, true);
        
        // Clear input
        this.elements.messageInput.value = '';
    }

    displayMessage(sender, message, isOwn) {
        // Remove empty state
        const emptyState = this.elements.chatMessages.querySelector('.chat-empty');
        if (emptyState) {
            emptyState.classList.add('hidden');
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : this.escapeHtml(sender)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================
    // CALL MANAGEMENT
    // ==========================================
    
    endCall() {
        this.cleanup();
        this.showSetupScreen();
        this.updateConnectionStatus('offline', 'Disconnected');
        this.showToast('Call ended', 'info');
        
        // Reset UI
        this.elements.remoteVideo.srcObject = null;
        this.elements.remotePlaceholder.classList.remove('hidden');
        this.elements.remoteName.classList.remove('visible');
        
        // Clear chat
        this.elements.chatMessages.innerHTML = `
            <div class="chat-empty">
                <i class="fas fa-comment-dots"></i>
                <p>No messages yet</p>
            </div>
        `;
        
        // Reset controls
        this.elements.toggleScreenShare.classList.remove('active-share');
        this.elements.toggleVideo.dataset.active = 'true';
        this.elements.toggleVideo.querySelector('i').className = 'fas fa-video';
        this.elements.toggleAudio.dataset.active = 'true';
        this.elements.toggleAudio.querySelector('i').className = 'fas fa-microphone';
        
        // Reinitialize media
        setTimeout(() => {
            this.initializeMedia();
        }, 500);
    }

    cleanup() {
        console.log('Cleaning up...');
        
        // Stop screen share
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
            this.isScreenSharing = false;
        }
        
        // Close data connection
        if (this.activeConnection) {
            this.activeConnection.close();
            this.activeConnection = null;
        }
        
        // Close call
        if (this.activeCall) {
            this.activeCall.close();
            this.activeCall = null;
        }
        
        // Destroy peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.remoteName = '';
        this.isHost = false;
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check',
            error: 'fa-times',
            info: 'fa-info'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <span class="toast-message">${message}</span>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConnectHub();
    console.log('ConnectHub initialized');
});