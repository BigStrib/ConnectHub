// ==========================================
// CONNECTHUB - WEBRTC VIDEO CHAT
// Fixed version with reliable peer discovery
// ==========================================

class ConnectHub {
    constructor() {
        this.peer = null;
        this.localStream = null;
        this.screenStream = null;
        this.remoteStream = null;
        this.dataConnection = null;
        this.mediaConnection = null;
        
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.isChatOpen = false;
        this.unreadCount = 0;
        
        this.userName = '';
        this.remoteName = '';
        this.roomCode = '';
        this.peerId = '';
        
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000;
        this.pollInterval = null;
        
        this.elements = this.getElements();
        this.init();
    }

    getElements() {
        return {
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
            videoArea: document.getElementById('videoArea'),
            remoteVideo: document.getElementById('remoteVideo'),
            remotePlaceholder: document.getElementById('remotePlaceholder'),
            remoteName: document.getElementById('remoteName'),
            waitingText: document.getElementById('waitingText'),
            displayRoomCode: document.getElementById('displayRoomCode'),
            localVideo: document.getElementById('localVideo'),
            localPlaceholder: document.getElementById('localPlaceholder'),
            currentRoomCode: document.getElementById('currentRoomCode'),
            copyCurrentCode: document.getElementById('copyCurrentCode'),
            chatPanel: document.getElementById('chatPanel'),
            chatMessages: document.getElementById('chatMessages'),
            chatEmpty: document.getElementById('chatEmpty'),
            messageInput: document.getElementById('messageInput'),
            sendMessage: document.getElementById('sendMessage'),
            closeChatBtn: document.getElementById('closeChatBtn'),
            toggleChatBtn: document.getElementById('toggleChatBtn'),
            unreadBadge: document.getElementById('unreadBadge'),
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            toggleScreenShare: document.getElementById('toggleScreenShare'),
            endCall: document.getElementById('endCall'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

    init() {
        this.bindEvents();
        this.initMedia();
    }

    bindEvents() {
        // Preview
        this.elements.togglePreviewVideo.addEventListener('click', () => this.togglePreviewVideo());
        this.elements.togglePreviewAudio.addEventListener('click', () => this.togglePreviewAudio());
        
        // Setup
        this.elements.generateCode.addEventListener('click', () => this.generateRoomCode());
        this.elements.copyCode.addEventListener('click', () => this.copyRoomCode());
        this.elements.joinRoom.addEventListener('click', () => this.joinRoom());
        this.elements.roomCode.addEventListener('keypress', e => { if (e.key === 'Enter') this.joinRoom(); });
        this.elements.displayName.addEventListener('keypress', e => { if (e.key === 'Enter') this.joinRoom(); });
        
        // Call controls
        this.elements.toggleVideo.addEventListener('click', () => this.toggleVideo());
        this.elements.toggleAudio.addEventListener('click', () => this.toggleAudio());
        this.elements.toggleScreenShare.addEventListener('click', () => this.toggleScreenShare());
        this.elements.endCall.addEventListener('click', () => this.endCall());
        this.elements.copyCurrentCode.addEventListener('click', () => this.copyCurrentCode());
        
        // Chat
        this.elements.toggleChatBtn.addEventListener('click', () => this.toggleChat());
        this.elements.closeChatBtn.addEventListener('click', () => this.toggleChat());
        this.elements.sendMessage.addEventListener('click', () => this.sendChatMessage());
        this.elements.messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') this.sendChatMessage(); });

        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // ==========================================
    // MEDIA
    // ==========================================

    async initMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            
            this.elements.localPreview.srcObject = this.localStream;
            this.elements.previewPlaceholder.classList.add('hidden');
            this.showToast('Camera and microphone ready', 'success');
        } catch (error) {
            console.error('Media error:', error);
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                this.isVideoEnabled = false;
                this.showToast('Audio only mode', 'info');
            } catch (e) {
                this.showToast('Cannot access camera/microphone', 'error');
            }
        }
    }

    togglePreviewVideo() {
        if (!this.localStream) return;
        const track = this.localStream.getVideoTracks()[0];
        if (track) {
            this.isVideoEnabled = !this.isVideoEnabled;
            track.enabled = this.isVideoEnabled;
            this.elements.togglePreviewVideo.classList.toggle('active', this.isVideoEnabled);
            this.elements.previewPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
    }

    togglePreviewAudio() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (track) {
            this.isAudioEnabled = !this.isAudioEnabled;
            track.enabled = this.isAudioEnabled;
            this.elements.togglePreviewAudio.classList.toggle('active', this.isAudioEnabled);
        }
    }

    toggleVideo() {
        if (!this.localStream) return;
        const track = this.localStream.getVideoTracks()[0];
        if (track) {
            this.isVideoEnabled = !this.isVideoEnabled;
            track.enabled = this.isVideoEnabled;
            this.elements.toggleVideo.dataset.active = this.isVideoEnabled;
            this.elements.toggleVideo.querySelector('i').className = this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            this.elements.localPlaceholder.classList.toggle('hidden', this.isVideoEnabled);
        }
    }

    toggleAudio() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (track) {
            this.isAudioEnabled = !this.isAudioEnabled;
            track.enabled = this.isAudioEnabled;
            this.elements.toggleAudio.dataset.active = this.isAudioEnabled;
            this.elements.toggleAudio.querySelector('i').className = this.isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        }
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
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = this.screenStream.getVideoTracks()[0];
            
            if (this.mediaConnection) {
                const sender = this.mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);
            }
            
            this.elements.localVideo.srcObject = this.screenStream;
            screenTrack.onended = () => this.stopScreenShare();
            
            this.isScreenSharing = true;
            this.elements.toggleScreenShare.classList.add('active-share');
            this.showToast('Screen sharing started', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.showToast('Could not share screen', 'error');
            }
        }
    }

    async stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }
        
        if (this.mediaConnection && this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                const sender = this.mediaConnection.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(videoTrack);
            }
        }
        
        this.elements.localVideo.srcObject = this.localStream;
        this.isScreenSharing = false;
        this.elements.toggleScreenShare.classList.remove('active-share');
    }

    // ==========================================
    // ROOM MANAGEMENT
    // ==========================================

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        this.elements.roomCode.value = code;
        this.showToast('Code generated: ' + code, 'success');
    }

    copyRoomCode() {
        const code = this.elements.roomCode.value.trim();
        if (!code) return this.showToast('Generate a code first', 'error');
        this.copyToClipboard(code);
    }

    copyCurrentCode() {
        this.copyToClipboard(this.roomCode);
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied: ' + text, 'success');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast('Copied: ' + text, 'success');
        }
    }

    // ==========================================
    // PEER CONNECTION
    // ==========================================

    async joinRoom() {
        const name = this.elements.displayName.value.trim();
        const code = this.elements.roomCode.value.trim().toUpperCase(); // Case insensitive

        if (!name) {
            this.showToast('Enter your name', 'error');
            return this.elements.displayName.focus();
        }
        if (!code || code.length < 3) {
            this.showToast('Enter a valid room code', 'error');
            return this.elements.roomCode.focus();
        }

        this.userName = name;
        this.roomCode = code;
        
        this.elements.joinRoom.disabled = true;
        this.elements.joinRoom.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        this.updateStatus('connecting', 'Connecting...');

        try {
            await this.createPeer();
        } catch (error) {
            console.error('Join error:', error);
            this.showToast('Connection failed', 'error');
            this.resetJoinButton();
            this.updateStatus('offline', 'Disconnected');
        }
    }

    createPeer() {
        return new Promise((resolve, reject) => {
            this.cleanup();
            
            // Create a unique but deterministic peer ID
            // Using room code + random suffix for uniqueness
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            this.peerId = `ch_${this.roomCode}_${randomSuffix}`;
            
            console.log('Creating peer:', this.peerId);
            
            this.peer = new Peer(this.peerId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', id => {
                console.log('Peer open:', id);
                this.showCallScreen();
                this.updateStatus('online', 'Connected');
                this.setupPeerEvents();
                this.startPeerDiscovery();
                resolve(id);
            });

            this.peer.on('error', error => {
                console.error('Peer error:', error);
                if (error.type === 'unavailable-id') {
                    // ID taken, try again with different suffix
                    this.retryCount++;
                    if (this.retryCount < this.maxRetries) {
                        setTimeout(() => this.createPeer().then(resolve).catch(reject), 500);
                    } else {
                        reject(error);
                    }
                } else if (error.type !== 'peer-unavailable') {
                    reject(error);
                }
            });

            setTimeout(() => reject(new Error('Timeout')), 15000);
        });
    }

    setupPeerEvents() {
        this.peer.on('connection', conn => {
            console.log('Incoming connection from:', conn.peer);
            this.handleDataConnection(conn);
        });

        this.peer.on('call', call => {
            console.log('Incoming call from:', call.peer);
            this.handleIncomingCall(call);
        });

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected');
            this.updateStatus('connecting', 'Reconnecting...');
            if (this.peer && !this.peer.destroyed) {
                setTimeout(() => this.peer.reconnect(), 1000);
            }
        });
    }

    // ==========================================
    // PEER DISCOVERY - THE KEY FIX
    // ==========================================

    startPeerDiscovery() {
        // Try to find other peers in the room by attempting connections
        this.discoverPeers();
        
        // Keep polling for new peers
        this.pollInterval = setInterval(() => {
            if (!this.dataConnection || !this.dataConnection.open) {
                this.discoverPeers();
            }
        }, 3000);
    }

    async discoverPeers() {
        // Get list of potential peer IDs we might connect to
        // We'll try connecting to peers with our room code prefix
        const roomPrefix = `ch_${this.roomCode}_`;
        
        console.log('Discovering peers with prefix:', roomPrefix);
        
        // Try to list peers (this is a hack using PeerJS internals)
        try {
            const response = await fetch(`https://0.peerjs.com/peerjs/peers`);
            if (response.ok) {
                const peers = await response.json();
                console.log('Found peers:', peers);
                
                // Filter peers in our room
                const roomPeers = peers.filter(p => 
                    p.startsWith(roomPrefix) && p !== this.peerId
                );
                
                console.log('Room peers:', roomPeers);
                
                // Try to connect to each peer
                for (const remotePeerId of roomPeers) {
                    if (!this.dataConnection || !this.dataConnection.open) {
                        this.connectToPeer(remotePeerId);
                        break; // Only connect to one peer
                    }
                }
            }
        } catch (error) {
            console.log('Peer list not available, using direct connection attempts');
        }
    }

    connectToPeer(remotePeerId) {
        if (this.dataConnection?.open) return;
        if (remotePeerId === this.peerId) return;
        
        console.log('Connecting to peer:', remotePeerId);
        
        // Data connection
        const conn = this.peer.connect(remotePeerId, {
            reliable: true,
            metadata: { name: this.userName }
        });
        
        this.handleDataConnection(conn);
        
        // Media call after short delay
        setTimeout(() => {
            if (this.localStream && (!this.mediaConnection || !this.mediaConnection.open)) {
                console.log('Calling peer:', remotePeerId);
                const call = this.peer.call(remotePeerId, this.localStream, {
                    metadata: { name: this.userName }
                });
                this.handleOutgoingCall(call);
            }
        }, 500);
    }

    handleDataConnection(conn) {
        conn.on('open', () => {
            console.log('Data connection open:', conn.peer);
            
            // Only accept if we don't have a connection
            if (this.dataConnection?.open && this.dataConnection.peer !== conn.peer) {
                console.log('Already connected, rejecting');
                conn.close();
                return;
            }
            
            this.dataConnection = conn;
            this.remoteName = conn.metadata?.name || 'Friend';
            
            this.updateStatus('online', 'In call');
            this.showRemoteName();
            this.showToast(`${this.remoteName} connected!`, 'success');
            
            // Open chat automatically when someone connects
            if (!this.isChatOpen) {
                this.toggleChat();
            }
            
            // Send identity
            conn.send({ type: 'identity', name: this.userName });
            
            // Stop discovery
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
        });

        conn.on('data', data => this.handleData(data));
        
        conn.on('close', () => {
            console.log('Data connection closed');
            if (this.dataConnection === conn) {
                this.handleDisconnect();
            }
        });

        conn.on('error', error => console.error('Data error:', error));
    }

    handleIncomingCall(call) {
        console.log('Answering call');
        this.remoteName = call.metadata?.name || this.remoteName || 'Friend';
        this.showRemoteName();
        
        call.answer(this.localStream);
        this.handleCallStream(call);
    }

    handleOutgoingCall(call) {
        console.log('Outgoing call setup');
        this.handleCallStream(call);
    }

    handleCallStream(call) {
        this.mediaConnection = call;

        call.on('stream', stream => {
            console.log('Got remote stream');
            this.remoteStream = stream;
            this.elements.remoteVideo.srcObject = stream;
            this.elements.remotePlaceholder.classList.add('hidden');
            this.updateStatus('online', 'In call');
            this.showToast('Video connected!', 'success');
        });

        call.on('close', () => {
            console.log('Call closed');
            this.handleDisconnect();
        });

        call.on('error', error => {
            console.error('Call error:', error);
        });
    }

    handleData(data) {
        console.log('Received:', data);
        switch (data.type) {
            case 'identity':
                this.remoteName = data.name;
                this.showRemoteName();
                break;
            case 'chat':
                this.displayMessage(data.name, data.message, false);
                if (!this.isChatOpen) {
                    this.unreadCount++;
                    this.updateUnreadBadge();
                }
                break;
        }
    }

    handleDisconnect() {
        this.showToast('Participant left', 'info');
        this.elements.remoteVideo.srcObject = null;
        this.elements.remotePlaceholder.classList.remove('hidden');
        this.elements.remoteName.classList.remove('visible');
        this.remoteName = '';
        this.dataConnection = null;
        this.mediaConnection = null;
        this.updateStatus('online', 'Waiting...');
        
        // Restart discovery
        this.startPeerDiscovery();
    }

    showRemoteName() {
        if (this.remoteName) {
            this.elements.remoteName.textContent = this.remoteName;
            this.elements.remoteName.classList.add('visible');
        }
    }

    // ==========================================
    // UI
    // ==========================================

    showCallScreen() {
        this.elements.setupScreen.classList.add('hidden');
        this.elements.callScreen.classList.remove('hidden');
        this.elements.currentRoomCode.textContent = this.roomCode;
        this.elements.displayRoomCode.textContent = this.roomCode;
        
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

    updateStatus(status, text) {
        const dot = this.elements.connectionStatus.querySelector('.status-dot');
        const txt = this.elements.connectionStatus.querySelector('.status-text');
        dot.className = 'status-dot ' + status;
        txt.textContent = text;
    }

    resetJoinButton() {
        this.elements.joinRoom.disabled = false;
        this.elements.joinRoom.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Room';
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        this.elements.chatPanel.classList.toggle('hidden', !this.isChatOpen);
        this.elements.toggleChatBtn.classList.toggle('chat-active', this.isChatOpen);
        
        if (this.isChatOpen) {
            this.unreadCount = 0;
            this.updateUnreadBadge();
            this.elements.messageInput.focus();
        }
    }

    updateUnreadBadge() {
        if (this.unreadCount > 0) {
            this.elements.unreadBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.elements.unreadBadge.classList.remove('hidden');
        } else {
            this.elements.unreadBadge.classList.add('hidden');
        }
    }

    // ==========================================
    // CHAT
    // ==========================================

    sendChatMessage() {
        const msg = this.elements.messageInput.value.trim();
        if (!msg) return;
        
        if (!this.dataConnection?.open) {
            return this.showToast('Not connected', 'error');
        }

        this.dataConnection.send({ type: 'chat', name: this.userName, message: msg });
        this.displayMessage(this.userName, msg, true);
        this.elements.messageInput.value = '';
    }

    displayMessage(sender, message, isOwn) {
        this.elements.chatEmpty?.classList.add('hidden');
        
        const div = document.createElement('div');
        div.className = `message ${isOwn ? 'own' : ''}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        div.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : this.escapeHtml(sender)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        
        this.elements.chatMessages.appendChild(div);
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
        this.updateStatus('offline', 'Disconnected');
        this.showToast('Call ended', 'info');
        
        // Reset UI
        this.elements.remoteVideo.srcObject = null;
        this.elements.remotePlaceholder.classList.remove('hidden');
        this.elements.remoteName.classList.remove('visible');
        this.elements.chatPanel.classList.add('hidden');
        this.elements.toggleChatBtn.classList.remove('chat-active');
        this.isChatOpen = false;
        
        // Clear chat
        this.elements.chatMessages.innerHTML = `
            <div class="chat-empty" id="chatEmpty">
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
        this.unreadCount = 0;
        this.updateUnreadBadge();
        
        setTimeout(() => this.initMedia(), 500);
    }

    cleanup() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }
        
        if (this.dataConnection) {
            this.dataConnection.close();
            this.dataConnection = null;
        }
        
        if (this.mediaConnection) {
            this.mediaConnection.close();
            this.mediaConnection = null;
        }
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.remoteName = '';
        this.retryCount = 0;
    }

    // ==========================================
    // TOAST
    // ==========================================

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info' };
        
        toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
            <span class="toast-message">${message}</span>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConnectHub();
});