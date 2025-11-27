// ==========================================
// CONNECTHUB - WEBRTC VIDEO CHAT APPLICATION
// ==========================================

class ConnectHub {
    constructor() {
        // State
        this.peer = null;
        this.connection = null;
        this.call = null;
        this.localStream = null;
        this.screenStream = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.userName = '';
        this.remoteName = '';
        this.roomCode = '';
        this.isChatOpen = true;

        // DOM Elements
        this.elements = {
            // Status
            connectionStatus: document.getElementById('connectionStatus'),
            
            // Screens
            setupScreen: document.getElementById('setupScreen'),
            callScreen: document.getElementById('callScreen'),
            
            // Preview
            localPreview: document.getElementById('localPreview'),
            previewPlaceholder: document.getElementById('previewPlaceholder'),
            togglePreviewVideo: document.getElementById('togglePreviewVideo'),
            togglePreviewAudio: document.getElementById('togglePreviewAudio'),
            
            // Setup Form
            displayName: document.getElementById('displayName'),
            roomCode: document.getElementById('roomCode'),
            generateCode: document.getElementById('generateCode'),
            copyCode: document.getElementById('copyCode'),
            joinRoom: document.getElementById('joinRoom'),
            
            // Call Screen Videos
            remoteVideo: document.getElementById('remoteVideo'),
            remotePlaceholder: document.getElementById('remotePlaceholder'),
            remoteName: document.getElementById('remoteName'),
            localVideo: document.getElementById('localVideo'),
            localPlaceholder: document.getElementById('localPlaceholder'),
            currentRoomCode: document.getElementById('currentRoomCode'),
            copyCurrentCode: document.getElementById('copyCurrentCode'),
            
            // Chat
            chatPanel: document.getElementById('chatPanel'),
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendMessage: document.getElementById('sendMessage'),
            toggleChat: document.getElementById('toggleChat'),
            
            // Controls
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            toggleScreenShare: document.getElementById('toggleScreenShare'),
            endCall: document.getElementById('endCall'),
            
            // Toast
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
        
        // Call controls
        this.elements.toggleVideo.addEventListener('click', () => this.toggleVideo());
        this.elements.toggleAudio.addEventListener('click', () => this.toggleAudio());
        this.elements.toggleScreenShare.addEventListener('click', () => this.toggleScreenShare());
        this.elements.endCall.addEventListener('click', () => this.endCall());
        this.elements.copyCurrentCode.addEventListener('click', () => this.copyCurrentRoomCode());
        
        // Chat
        this.elements.toggleChat.addEventListener('click', () => this.toggleChatPanel());
        this.elements.sendMessage.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
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
            this.showToast('Could not access camera/microphone', 'error');
            this.isVideoEnabled = false;
            this.isAudioEnabled = false;
        }
    }

    togglePreviewVideo() {
        if (!this.localStream) return;
        
        this.isVideoEnabled = !this.isVideoEnabled;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = this.isVideoEnabled;
        }
        
        this.elements.togglePreviewVideo.classList.toggle('active', this.isVideoEnabled);
        this.elements.previewPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
    }

    togglePreviewAudio() {
        if (!this.localStream) return;
        
        this.isAudioEnabled = !this.isAudioEnabled;
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = this.isAudioEnabled;
        }
        
        this.elements.togglePreviewAudio.classList.toggle('active', this.isAudioEnabled);
    }

    toggleVideo() {
        if (!this.localStream) return;
        
        this.isVideoEnabled = !this.isVideoEnabled;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = this.isVideoEnabled;
        }
        
        this.elements.toggleVideo.dataset.active = this.isVideoEnabled;
        this.elements.toggleVideo.querySelector('i').className = 
            this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
        this.elements.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
    }

    toggleAudio() {
        if (!this.localStream) return;
        
        this.isAudioEnabled = !this.isAudioEnabled;
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = this.isAudioEnabled;
        }
        
        this.elements.toggleAudio.dataset.active = this.isAudioEnabled;
        this.elements.toggleAudio.querySelector('i').className = 
            this.isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
    }

    async toggleScreenShare() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
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
            if (this.call && this.call.peerConnection) {
                const sender = this.call.peerConnection.getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }
            
            // Update local video
            this.elements.localVideo.srcObject = this.screenStream;
            
            // Handle screen share stop
            screenTrack.onended = () => this.stopScreenShare();
            
            this.isScreenSharing = true;
            this.elements.toggleScreenShare.classList.add('active-share');
            this.showToast('Screen sharing started', 'success');
            
        } catch (error) {
            console.error('Screen share error:', error);
            if (error.name !== 'AbortError') {
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
        if (this.call && this.call.peerConnection && this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                const sender = this.call.peerConnection.getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            }
        }
        
        this.elements.localVideo.srcObject = this.localStream;
        this.isScreenSharing = false;
        this.elements.toggleScreenShare.classList.remove('active-share');
        this.showToast('Screen sharing stopped', 'info');
    }

    // ==========================================
    // ROOM MANAGEMENT
    // ==========================================
    
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.elements.roomCode.value = code;
        this.showToast('Room code generated', 'success');
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
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Copied to clipboard!', 'success');
        }
    }

    // ==========================================
    // PEER CONNECTION
    // ==========================================
    
    async joinRoom() {
        const name = this.elements.displayName.value.trim();
        const code = this.elements.roomCode.value.trim().toUpperCase();
        
        if (!name) {
            this.showToast('Please enter your name', 'error');
            this.elements.displayName.focus();
            return;
        }
        
        if (!code) {
            this.showToast('Please enter or generate a room code', 'error');
            this.elements.roomCode.focus();
            return;
        }
        
        this.userName = name;
        this.roomCode = code;
        
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        try {
            await this.initializePeer();
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showToast('Connection failed. Please try again.', 'error');
            this.updateConnectionStatus('offline', 'Disconnected');
        }
    }

    async initializePeer() {
        // Create unique peer ID based on room code
        const peerId = `connecthub-${this.roomCode}-${Date.now()}`;
        
        this.peer = new Peer(peerId, {
            debug: 1
        });
        
        this.peer.on('open', (id) => {
            console.log('Peer connected with ID:', id);
            this.showCallScreen();
            this.updateConnectionStatus('online', 'Connected');
            
            // Try to connect to existing peer in the room
            this.connectToRoom();
        });
        
        this.peer.on('connection', (conn) => {
            console.log('Incoming data connection');
            this.handleDataConnection(conn);
        });
        
        this.peer.on('call', (call) => {
            console.log('Incoming call');
            this.handleIncomingCall(call);
        });
        
        this.peer.on('error', (error) => {
            console.error('Peer error:', error);
            
            if (error.type === 'peer-unavailable') {
                // No one in the room yet, wait for connections
                this.showToast('Waiting for someone to join...', 'info');
            } else if (error.type === 'unavailable-id') {
                // Room is occupied, try connecting as second peer
                this.connectAsSecondPeer();
            } else {
                this.showToast(`Connection error: ${error.type}`, 'error');
            }
        });
        
        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.updateConnectionStatus('offline', 'Disconnected');
        });
    }

    connectToRoom() {
        // Try to find existing peer in the room
        // Generate the expected peer ID pattern
        const roomPrefix = `connecthub-${this.roomCode}-`;
        
        // Attempt to connect to potential existing peer
        this.tryConnectToPeer(roomPrefix);
    }

    async tryConnectToPeer(roomPrefix) {
        // In a real application, you would use a signaling server
        // For this demo, we'll use PeerJS's built-in discovery
        
        // Wait a moment then show waiting message
        setTimeout(() => {
            if (!this.connection) {
                this.showToast('Share your room code for someone to join', 'info');
            }
        }, 2000);
    }

    connectAsSecondPeer() {
        // Create new peer with timestamp to ensure unique ID
        const newPeerId = `connecthub-${this.roomCode}-${Date.now()}-2`;
        
        this.peer = new Peer(newPeerId, { debug: 1 });
        
        this.peer.on('open', () => {
            // Try to connect to the first peer
            const firstPeerId = this.findFirstPeer();
            if (firstPeerId) {
                this.initiateConnection(firstPeerId);
            }
        });
    }

    findFirstPeer() {
        // In production, use signaling server
        // For demo, this is a placeholder
        return null;
    }

    initiateConnection(remotePeerId) {
        // Data connection for chat
        this.connection = this.peer.connect(remotePeerId, {
            metadata: { name: this.userName }
        });
        
        this.handleDataConnection(this.connection);
        
        // Media call
        if (this.localStream) {
            this.call = this.peer.call(remotePeerId, this.localStream, {
                metadata: { name: this.userName }
            });
            this.handleCall(this.call);
        }
    }

    handleDataConnection(conn) {
        this.connection = conn;
        
        conn.on('open', () => {
            console.log('Data connection established');
            this.remoteName = conn.metadata?.name || 'Participant';
            this.showRemoteName();
            this.showToast(`${this.remoteName} connected!`, 'success');
            
            // Send our name
            conn.send({
                type: 'name',
                name: this.userName
            });
        });
        
        conn.on('data', (data) => {
            this.handleDataMessage(data);
        });
        
        conn.on('close', () => {
            console.log('Data connection closed');
            this.handlePeerDisconnect();
        });
        
        conn.on('error', (error) => {
            console.error('Data connection error:', error);
        });
    }

    handleIncomingCall(call) {
        this.remoteName = call.metadata?.name || 'Participant';
        this.showRemoteName();
        
        // Answer the call
        call.answer(this.localStream);
        this.handleCall(call);
        
        // If we don't have a data connection, create one
        if (!this.connection) {
            this.connection = this.peer.connect(call.peer, {
                metadata: { name: this.userName }
            });
            this.handleDataConnection(this.connection);
        }
    }

    handleCall(call) {
        this.call = call;
        
        call.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            this.elements.remoteVideo.srcObject = remoteStream;
            this.elements.remotePlaceholder.classList.add('hidden');
            this.showToast('Video connected!', 'success');
        });
        
        call.on('close', () => {
            console.log('Call ended');
            this.handlePeerDisconnect();
        });
        
        call.on('error', (error) => {
            console.error('Call error:', error);
            this.showToast('Call error occurred', 'error');
        });
    }

    handleDataMessage(data) {
        switch (data.type) {
            case 'name':
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
        this.showToast('Participant disconnected', 'info');
        this.elements.remoteVideo.srcObject = null;
        this.elements.remotePlaceholder.classList.remove('hidden');
        this.elements.remoteName.classList.remove('visible');
        this.remoteName = '';
        this.connection = null;
        this.call = null;
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
        
        // Set local video
        this.elements.localVideo.srcObject = this.localStream;
        this.elements.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
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
    
    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message) return;
        
        if (!this.connection || !this.connection.open) {
            this.showToast('No one is connected yet', 'error');
            return;
        }
        
        // Send message
        this.connection.send({
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
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : sender}</span>
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
        
        // Reset remote video
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
        
        // Reinitialize media
        this.initializeMedia();
    }

    cleanup() {
        // Close peer connection
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        
        // Close call
        if (this.call) {
            this.call.close();
            this.call = null;
        }
        
        // Destroy peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        // Stop screen share
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        this.isScreenSharing = false;
        this.remoteName = '';
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
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ==========================================
// SIMPLE SIGNALING USING BROADCAST CHANNEL
// (Works for same-browser tabs - for demo purposes)
// ==========================================

class SimpleSignaling {
    constructor(app) {
        this.app = app;
        this.channel = null;
    }

    join(roomCode) {
        this.channel = new BroadcastChannel(`connecthub-${roomCode}`);
        
        this.channel.onmessage = (event) => {
            this.handleSignal(event.data);
        };
        
        // Announce presence
        this.broadcast({
            type: 'join',
            peerId: this.app.peer?.id,
            name: this.app.userName
        });
    }

    broadcast(data) {
        if (this.channel) {
            this.channel.postMessage(data);
        }
    }

    handleSignal(data) {
        switch (data.type) {
            case 'join':
                if (data.peerId && data.peerId !== this.app.peer?.id) {
                    // Someone joined, try to connect
                    this.app.initiateConnection(data.peerId);
                }
                break;
        }
    }

    leave() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
    }
}

// ==========================================
// ENHANCED APP WITH SIGNALING
// ==========================================

class ConnectHubEnhanced extends ConnectHub {
    constructor() {
        super();
        this.signaling = new SimpleSignaling(this);
    }

    async initializePeer() {
        const peerId = `connecthub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        this.peer = new Peer(peerId, { debug: 1 });
        
        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log('Peer connected with ID:', id);
                this.showCallScreen();
                this.updateConnectionStatus('online', 'Connected');
                
                // Join signaling channel
                this.signaling.join(this.roomCode);
                
                resolve(id);
            });
            
            this.peer.on('connection', (conn) => {
                console.log('Incoming data connection from:', conn.peer);
                this.handleDataConnection(conn);
            });
            
            this.peer.on('call', (call) => {
                console.log('Incoming call from:', call.peer);
                this.handleIncomingCall(call);
            });
            
            this.peer.on('error', (error) => {
                console.error('Peer error:', error);
                
                if (error.type !== 'peer-unavailable') {
                    this.showToast(`Error: ${error.type}`, 'error');
                }
            });
            
            this.peer.on('disconnected', () => {
                this.updateConnectionStatus('offline', 'Reconnecting...');
                this.peer.reconnect();
            });
        });
    }

    initiateConnection(remotePeerId) {
        if (remotePeerId === this.peer?.id) return;
        
        console.log('Initiating connection to:', remotePeerId);
        
        // Data connection for chat
        this.connection = this.peer.connect(remotePeerId, {
            metadata: { name: this.userName },
            reliable: true
        });
        
        this.handleDataConnection(this.connection);
        
        // Media call
        if (this.localStream) {
            setTimeout(() => {
                this.call = this.peer.call(remotePeerId, this.localStream, {
                    metadata: { name: this.userName }
                });
                this.handleCall(this.call);
            }, 500);
        }
    }

    cleanup() {
        this.signaling.leave();
        super.cleanup();
    }
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConnectHubEnhanced();
});