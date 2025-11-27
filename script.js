// ==========================================
// CONNECTHUB - WEBRTC VIDEO CHAT
// Simple and reliable peer-to-peer connection
// ==========================================

class ConnectHub {
    constructor() {
        // Peer connection
        this.peer = null;
        this.conn = null;
        this.call = null;
        
        // Media streams
        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;
        
        // State
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.isChatOpen = false;
        this.isConnected = false;
        this.unreadMessages = 0;
        
        // User info
        this.myName = '';
        this.remoteName = '';
        this.roomCode = '';
        this.myPeerId = '';
        
        // Get DOM elements
        this.cacheElements();
        
        // Initialize
        this.bindEvents();
        this.initCamera();
    }

    // ==========================================
    // CACHE DOM ELEMENTS
    // ==========================================
    
    cacheElements() {
        this.el = {
            // Screens
            setupScreen: document.getElementById('setupScreen'),
            callScreen: document.getElementById('callScreen'),
            
            // Status
            connectionStatus: document.getElementById('connectionStatus'),
            
            // Setup preview
            localPreview: document.getElementById('localPreview'),
            previewPlaceholder: document.getElementById('previewPlaceholder'),
            togglePreviewVideo: document.getElementById('togglePreviewVideo'),
            togglePreviewAudio: document.getElementById('togglePreviewAudio'),
            
            // Setup form
            displayName: document.getElementById('displayName'),
            roomCode: document.getElementById('roomCode'),
            generateCode: document.getElementById('generateCode'),
            copyCode: document.getElementById('copyCode'),
            joinRoom: document.getElementById('joinRoom'),
            
            // Call screen videos
            remoteVideo: document.getElementById('remoteVideo'),
            remotePlaceholder: document.getElementById('remotePlaceholder'),
            remoteName: document.getElementById('remoteName'),
            waitingText: document.getElementById('waitingText'),
            displayRoomCode: document.getElementById('displayRoomCode'),
            localVideo: document.getElementById('localVideo'),
            localPlaceholder: document.getElementById('localPlaceholder'),
            currentRoomCode: document.getElementById('currentRoomCode'),
            copyCurrentCode: document.getElementById('copyCurrentCode'),
            
            // Chat
            chatPanel: document.getElementById('chatPanel'),
            chatMessages: document.getElementById('chatMessages'),
            chatEmpty: document.getElementById('chatEmpty'),
            messageInput: document.getElementById('messageInput'),
            sendMessage: document.getElementById('sendMessage'),
            closeChatBtn: document.getElementById('closeChatBtn'),
            toggleChatBtn: document.getElementById('toggleChatBtn'),
            unreadBadge: document.getElementById('unreadBadge'),
            
            // Call controls
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            toggleScreenShare: document.getElementById('toggleScreenShare'),
            endCall: document.getElementById('endCall'),
            
            // Toast
            toastContainer: document.getElementById('toastContainer')
        };
    }

    // ==========================================
    // EVENT BINDINGS
    // ==========================================
    
    bindEvents() {
        // Preview controls
        this.el.togglePreviewVideo.onclick = () => this.togglePreviewCamera();
        this.el.togglePreviewAudio.onclick = () => this.togglePreviewMic();
        
        // Setup form
        this.el.generateCode.onclick = () => this.createRoomCode();
        this.el.copyCode.onclick = () => this.copyCode(this.el.roomCode.value);
        this.el.joinRoom.onclick = () => this.join();
        
        // Enter key to join
        this.el.displayName.onkeypress = (e) => e.key === 'Enter' && this.join();
        this.el.roomCode.onkeypress = (e) => e.key === 'Enter' && this.join();
        
        // Call controls
        this.el.toggleVideo.onclick = () => this.toggleCamera();
        this.el.toggleAudio.onclick = () => this.toggleMic();
        this.el.toggleScreenShare.onclick = () => this.toggleScreen();
        this.el.endCall.onclick = () => this.hangUp();
        this.el.copyCurrentCode.onclick = () => this.copyCode(this.roomCode);
        
        // Chat
        this.el.toggleChatBtn.onclick = () => this.toggleChat();
        this.el.closeChatBtn.onclick = () => this.toggleChat();
        this.el.sendMessage.onclick = () => this.sendChat();
        this.el.messageInput.onkeypress = (e) => e.key === 'Enter' && this.sendChat();
        
        // Cleanup on page close
        window.onbeforeunload = () => this.cleanup();
    }

    // ==========================================
    // CAMERA & MICROPHONE
    // ==========================================
    
    async initCamera() {
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
            
            this.el.localPreview.srcObject = this.localStream;
            this.el.previewPlaceholder.classList.add('hidden');
            this.toast('Camera ready', 'success');
            
        } catch (err) {
            console.error('Camera error:', err);
            
            // Try audio only
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.isVideoEnabled = false;
                this.el.togglePreviewVideo.classList.remove('active');
                this.toast('Camera unavailable, audio only', 'info');
            } catch (err2) {
                this.toast('Cannot access camera or microphone', 'error');
            }
        }
    }

    togglePreviewCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        this.isVideoEnabled = !this.isVideoEnabled;
        videoTrack.enabled = this.isVideoEnabled;
        
        this.el.togglePreviewVideo.classList.toggle('active', this.isVideoEnabled);
        this.el.previewPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
    }

    togglePreviewMic() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (!audioTrack) return;
        
        this.isAudioEnabled = !this.isAudioEnabled;
        audioTrack.enabled = this.isAudioEnabled;
        
        this.el.togglePreviewAudio.classList.toggle('active', this.isAudioEnabled);
    }

    toggleCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        this.isVideoEnabled = !this.isVideoEnabled;
        videoTrack.enabled = this.isVideoEnabled;
        
        this.el.toggleVideo.setAttribute('data-active', this.isVideoEnabled);
        this.el.toggleVideo.querySelector('i').className = 
            this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
        this.el.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
    }

    toggleMic() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (!audioTrack) return;
        
        this.isAudioEnabled = !this.isAudioEnabled;
        audioTrack.enabled = this.isAudioEnabled;
        
        this.el.toggleAudio.setAttribute('data-active', this.isAudioEnabled);
        this.el.toggleAudio.querySelector('i').className = 
            this.isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
    }

    async toggleScreen() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }

    async startScreenShare() {
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' }
            });
            
            const screenTrack = this.screenStream.getVideoTracks()[0];
            
            // Replace track in call
            if (this.call && this.call.peerConnection) {
                const sender = this.call.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                    
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }
            
            // Show screen in local video
            this.el.localVideo.srcObject = this.screenStream;
            
            // Handle stop
            screenTrack.onended = () => this.stopScreenShare();
            
            this.isScreenSharing = true;
            this.el.toggleScreenShare.classList.add('active-share');
            this.toast('Screen sharing', 'success');
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Screen share error:', err);
                this.toast('Could not share screen', 'error');
            }
        }
    }

    async stopScreenShare() {
        if (!this.screenStream) return;
        
        // Stop screen tracks
        this.screenStream.getTracks().forEach(t => t.stop());
        this.screenStream = null;
        
        // Restore camera track
        if (this.call && this.call.peerConnection && this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                const sender = this.call.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                    
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            }
        }
        
        // Show camera in local video
        this.el.localVideo.srcObject = this.localStream;
        
        this.isScreenSharing = false;
        this.el.toggleScreenShare.classList.remove('active-share');
    }

    // ==========================================
    // ROOM CODE
    // ==========================================
    
    createRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.el.roomCode.value = code;
        this.toast('Room code: ' + code, 'success');
    }

    async copyCode(code) {
        if (!code || !code.trim()) {
            this.toast('No code to copy', 'error');
            return;
        }
        
        code = code.trim().toUpperCase();
        
        try {
            await navigator.clipboard.writeText(code);
            this.toast('Copied: ' + code, 'success');
        } catch (err) {
            // Fallback
            const input = document.createElement('input');
            input.value = code;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.toast('Copied: ' + code, 'success');
        }
    }

    // ==========================================
    // JOIN ROOM
    // ==========================================
    
    async join() {
        // Validate
        const name = this.el.displayName.value.trim();
        const code = this.el.roomCode.value.trim().toUpperCase();
        
        if (!name) {
            this.toast('Please enter your name', 'error');
            this.el.displayName.focus();
            return;
        }
        
        if (!code || code.length < 3) {
            this.toast('Please enter a room code', 'error');
            this.el.roomCode.focus();
            return;
        }
        
        this.myName = name;
        this.roomCode = code;
        
        // Update UI
        this.el.joinRoom.disabled = true;
        this.el.joinRoom.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        this.setStatus('connecting', 'Connecting...');
        
        try {
            await this.connectToPeerServer();
        } catch (err) {
            console.error('Connection failed:', err);
            this.toast('Connection failed. Try again.', 'error');
            this.resetJoinButton();
            this.setStatus('offline', 'Disconnected');
        }
    }

    // ==========================================
    // PEER CONNECTION - MAIN LOGIC
    // ==========================================
    
    connectToPeerServer() {
        return new Promise((resolve, reject) => {
            // Clean up old peer
            if (this.peer) {
                this.peer.destroy();
            }
            
            // Create peer IDs based on room code
            // Person 1 will be: ROOMCODE-1
            // Person 2 will be: ROOMCODE-2
            const id1 = this.roomCode + '-1';
            const id2 = this.roomCode + '-2';
            
            // Try to be Person 1 first
            console.log('Trying to connect as:', id1);
            
            this.peer = new Peer(id1, {
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
            
            // Connection timeout
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 15000);
            
            this.peer.on('open', (id) => {
                clearTimeout(timeout);
                console.log('Connected as:', id);
                this.myPeerId = id;
                
                // Show call screen
                this.showCallScreen();
                
                // Set up event listeners
                this.setupPeerEvents();
                
                // If we're Person 1, wait for Person 2
                // If we're Person 2, connect to Person 1
                if (id === id1) {
                    // We are Person 1, wait for Person 2
                    this.setStatus('online', 'Waiting for friend...');
                    this.toast('Waiting for someone to join...', 'info');
                    
                    // Also try to connect to Person 2 in case they joined first
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.tryConnect(id2);
                        }
                    }, 2000);
                }
                
                resolve(id);
            });
            
            this.peer.on('error', (err) => {
                console.log('Peer error:', err.type, err);
                
                if (err.type === 'unavailable-id') {
                    // ID 1 is taken, try ID 2
                    clearTimeout(timeout);
                    console.log('ID taken, trying:', id2);
                    
                    this.peer.destroy();
                    this.peer = new Peer(id2, {
                        debug: 2,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:stun1.l.google.com:19302' }
                            ]
                        }
                    });
                    
                    this.peer.on('open', (id) => {
                        console.log('Connected as:', id);
                        this.myPeerId = id;
                        
                        this.showCallScreen();
                        this.setupPeerEvents();
                        
                        // We are Person 2, connect to Person 1
                        this.setStatus('online', 'Connecting to friend...');
                        
                        setTimeout(() => {
                            this.tryConnect(id1);
                        }, 500);
                        
                        resolve(id);
                    });
                    
                    this.peer.on('error', (err2) => {
                        if (err2.type === 'unavailable-id') {
                            this.toast('Room is full', 'error');
                            this.resetJoinButton();
                            reject(err2);
                        } else if (err2.type !== 'peer-unavailable') {
                            reject(err2);
                        }
                    });
                    
                } else if (err.type === 'peer-unavailable') {
                    // Other peer not online yet
                    console.log('Peer not available yet');
                    this.setStatus('online', 'Waiting for friend...');
                    
                } else {
                    reject(err);
                }
            });
        });
    }

    setupPeerEvents() {
        // Someone connects to us (data)
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.handleConnection(conn);
        });
        
        // Someone calls us (media)
        this.peer.on('call', (call) => {
            console.log('Incoming call from:', call.peer);
            this.handleIncomingCall(call);
        });
        
        // Disconnected from server
        this.peer.on('disconnected', () => {
            console.log('Disconnected from server');
            this.setStatus('connecting', 'Reconnecting...');
            
            // Try to reconnect
            setTimeout(() => {
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            }, 2000);
        });
    }

    tryConnect(peerId) {
        if (this.isConnected) return;
        
        console.log('Trying to connect to:', peerId);
        
        // Create data connection
        const conn = this.peer.connect(peerId, {
            reliable: true,
            metadata: { name: this.myName }
        });
        
        this.handleConnection(conn);
        
        // Create media call
        setTimeout(() => {
            if (this.localStream && !this.call) {
                console.log('Calling:', peerId);
                const call = this.peer.call(peerId, this.localStream, {
                    metadata: { name: this.myName }
                });
                this.handleOutgoingCall(call);
            }
        }, 1000);
    }

    handleConnection(conn) {
        conn.on('open', () => {
            console.log('Data connection open with:', conn.peer);
            
            // Save connection
            this.conn = conn;
            this.isConnected = true;
            this.remoteName = conn.metadata?.name || 'Friend';
            
            // Update UI
            this.setStatus('online', 'Connected');
            this.showRemoteName(this.remoteName);
            this.toast(this.remoteName + ' joined!', 'success');
            
            // Open chat
            if (!this.isChatOpen) {
                this.toggleChat();
            }
            
            // Send our name
            conn.send({
                type: 'name',
                name: this.myName
            });
        });
        
        conn.on('data', (data) => {
            this.handleMessage(data);
        });
        
        conn.on('close', () => {
            console.log('Connection closed');
            this.handleRemoteDisconnect();
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    handleIncomingCall(call) {
        console.log('Answering call');
        
        // Get name from metadata
        if (call.metadata?.name) {
            this.remoteName = call.metadata.name;
            this.showRemoteName(this.remoteName);
        }
        
        // Answer with our stream
        call.answer(this.localStream);
        
        // Handle the call
        this.setupCall(call);
    }

    handleOutgoingCall(call) {
        console.log('Outgoing call setup');
        this.setupCall(call);
    }

    setupCall(call) {
        this.call = call;
        
        call.on('stream', (remoteStream) => {
            console.log('Got remote stream!');
            this.remoteStream = remoteStream;
            
            // Show remote video
            this.el.remoteVideo.srcObject = remoteStream;
            this.el.remotePlaceholder.classList.add('hidden');
            
            this.setStatus('online', 'In call');
            this.toast('Video connected!', 'success');
        });
        
        call.on('close', () => {
            console.log('Call ended');
            this.handleRemoteDisconnect();
        });
        
        call.on('error', (err) => {
            console.error('Call error:', err);
        });
    }

    handleMessage(data) {
        console.log('Got message:', data);
        
        if (data.type === 'name') {
            this.remoteName = data.name;
            this.showRemoteName(this.remoteName);
            
        } else if (data.type === 'chat') {
            this.addChatMessage(data.name, data.text, false);
            
            // Show unread badge if chat is closed
            if (!this.isChatOpen) {
                this.unreadMessages++;
                this.updateUnreadBadge();
            }
        }
    }

    handleRemoteDisconnect() {
        console.log('Remote peer disconnected');
        
        this.isConnected = false;
        this.remoteName = '';
        this.conn = null;
        this.call = null;
        this.remoteStream = null;
        
        // Update UI
        this.el.remoteVideo.srcObject = null;
        this.el.remotePlaceholder.classList.remove('hidden');
        this.el.remoteName.classList.remove('visible');
        this.el.waitingText.textContent = 'Participant left';
        
        this.setStatus('online', 'Waiting...');
        this.toast('Participant disconnected', 'info');
    }

    // ==========================================
    // UI UPDATES
    // ==========================================
    
    showCallScreen() {
        this.el.setupScreen.classList.add('hidden');
        this.el.callScreen.classList.remove('hidden');
        
        // Set room code displays
        this.el.currentRoomCode.textContent = this.roomCode;
        this.el.displayRoomCode.textContent = this.roomCode;
        
        // Set local video
        if (this.localStream) {
            this.el.localVideo.srcObject = this.localStream;
            this.el.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
        
        this.resetJoinButton();
    }

    showSetupScreen() {
        this.el.callScreen.classList.add('hidden');
        this.el.setupScreen.classList.remove('hidden');
    }

    setStatus(type, text) {
        const dot = this.el.connectionStatus.querySelector('.status-dot');
        const label = this.el.connectionStatus.querySelector('.status-text');
        
        dot.className = 'status-dot ' + type;
        label.textContent = text;
    }

    resetJoinButton() {
        this.el.joinRoom.disabled = false;
        this.el.joinRoom.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Room';
    }

    showRemoteName(name) {
        this.el.remoteName.textContent = name;
        this.el.remoteName.classList.add('visible');
    }

    // ==========================================
    // CHAT
    // ==========================================
    
    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        
        this.el.chatPanel.classList.toggle('hidden', !this.isChatOpen);
        this.el.toggleChatBtn.classList.toggle('chat-active', this.isChatOpen);
        
        if (this.isChatOpen) {
            this.unreadMessages = 0;
            this.updateUnreadBadge();
            this.el.messageInput.focus();
        }
    }

    updateUnreadBadge() {
        if (this.unreadMessages > 0) {
            this.el.unreadBadge.textContent = this.unreadMessages > 9 ? '9+' : this.unreadMessages;
            this.el.unreadBadge.classList.remove('hidden');
        } else {
            this.el.unreadBadge.classList.add('hidden');
        }
    }

    sendChat() {
        const text = this.el.messageInput.value.trim();
        if (!text) return;
        
        if (!this.conn || !this.conn.open) {
            this.toast('Not connected yet', 'error');
            return;
        }
        
        // Send message
        this.conn.send({
            type: 'chat',
            name: this.myName,
            text: text
        });
        
        // Show in our chat
        this.addChatMessage(this.myName, text, true);
        
        // Clear input
        this.el.messageInput.value = '';
    }

    addChatMessage(sender, text, isMe) {
        // Hide empty state
        if (this.el.chatEmpty) {
            this.el.chatEmpty.classList.add('hidden');
        }
        
        const time = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message' + (isMe ? ' own' : '');
        
        msgDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${isMe ? 'You' : this.escapeHTML(sender)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHTML(text)}</div>
        `;
        
        this.el.chatMessages.appendChild(msgDiv);
        this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight;
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==========================================
    // END CALL
    // ==========================================
    
    hangUp() {
        this.cleanup();
        this.showSetupScreen();
        this.setStatus('offline', 'Disconnected');
        this.toast('Call ended', 'info');
        
        // Reset UI
        this.el.remoteVideo.srcObject = null;
        this.el.remotePlaceholder.classList.remove('hidden');
        this.el.remoteName.classList.remove('visible');
        this.el.waitingText.textContent = 'Waiting for participant...';
        
        // Close chat
        this.el.chatPanel.classList.add('hidden');
        this.el.toggleChatBtn.classList.remove('chat-active');
        this.isChatOpen = false;
        
        // Clear chat messages
        this.el.chatMessages.innerHTML = `
            <div class="chat-empty" id="chatEmpty">
                <i class="fas fa-comment-dots"></i>
                <p>No messages yet</p>
            </div>
        `;
        this.el.chatEmpty = document.getElementById('chatEmpty');
        
        // Reset controls
        this.el.toggleScreenShare.classList.remove('active-share');
        this.el.toggleVideo.setAttribute('data-active', 'true');
        this.el.toggleVideo.querySelector('i').className = 'fas fa-video';
        this.el.toggleAudio.setAttribute('data-active', 'true');
        this.el.toggleAudio.querySelector('i').className = 'fas fa-microphone';
        
        this.unreadMessages = 0;
        this.updateUnreadBadge();
        
        // Reinit camera
        setTimeout(() => this.initCamera(), 500);
    }

    cleanup() {
        // Stop screen share
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
            this.isScreenSharing = false;
        }
        
        // Close data connection
        if (this.conn) {
            this.conn.close();
            this.conn = null;
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
        
        this.isConnected = false;
        this.remoteName = '';
        this.remoteStream = null;
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    
    toast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        
        const icons = {
            success: 'fa-check',
            error: 'fa-times',
            info: 'fa-info'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <span class="toast-message">${message}</span>
        `;
        
        this.el.toastContainer.appendChild(toast);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ==========================================
// START APP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConnectHub();
    console.log('ConnectHub ready');
});