// ==========================================
// CONNECTHUB - SIMPLE WEBRTC VIDEO + CHAT
// Works with static hosting + PeerJS cloud
// ==========================================

'use strict';

// ICE servers for WebRTC
const ICE_CONFIG = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

class ConnectHub {
    constructor() {
        // ----- Core WebRTC / PeerJS state -----
        this.peer = null;          // PeerJS Peer
        this.dataConn = null;      // PeerJS DataConnection (chat, signaling)
        this.mediaCall = null;     // PeerJS MediaConnection (audio/video)
        this.localStream = null;   // getUserMedia stream (camera + mic)
        this.screenStream = null;  // getDisplayMedia stream (screen share)
        this.remoteStream = null;

        // ----- App state -----
        this.displayName = '';
        this.remoteName = '';
        this.roomCode = '';
        this.isHost = false;       // true = host, false = guest
        this.isConnected = false;

        this.isVideoOn = true;
        this.isAudioOn = true;
        this.isScreenSharing = false;
        this.isChatOpen = false;
        this.unreadCount = 0;
        this.guestConnectTimer = null;

        // ----- DOM cache -----
        this.dom = this.cacheDom();

        // ----- Init -----
        this.bindUiEvents();
        this.initLocalPreview();

        window.addEventListener('beforeunload', () => {
            this.cleanupConnections();
        });
    }

    // ==========================================
    // DOM CACHE
    // ==========================================

    cacheDom() {
        return {
            // Screens
            setupScreen: document.getElementById('setupScreen'),
            callScreen: document.getElementById('callScreen'),

            // Status
            connectionStatus: document.getElementById('connectionStatus'),

            // Setup / preview
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

            // Call videos
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

            // Controls
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            toggleScreenShare: document.getElementById('toggleScreenShare'),
            endCall: document.getElementById('endCall'),

            // Toasts
            toastContainer: document.getElementById('toastContainer')
        };
    }

    // ==========================================
    // UI EVENT BINDINGS
    // ==========================================

    bindUiEvents() {
        const d = this.dom;

        // Preview controls
        d.togglePreviewVideo.addEventListener('click', () => this.togglePreviewVideo());
        d.togglePreviewAudio.addEventListener('click', () => this.togglePreviewAudio());

        // Setup form
        d.generateCode.addEventListener('click', () => this.generateRoomCode());
        d.copyCode.addEventListener('click', () => this.copyText(d.roomCode.value));
        d.joinRoom.addEventListener('click', () => this.joinRoom());

        // Only button click, no key handlers that interfere with typing
        // (this avoids any weird input behavior on desktop browsers)

        // Call controls
        d.toggleVideo.addEventListener('click', () => this.toggleVideo());
        d.toggleAudio.addEventListener('click', () => this.toggleAudio());
        d.toggleScreenShare.addEventListener('click', () => this.toggleScreenShare());
        d.endCall.addEventListener('click', () => this.endCall());
        d.copyCurrentCode.addEventListener('click', () => this.copyText(this.roomCode));

        // Chat controls
        d.toggleChatBtn.addEventListener('click', () => this.toggleChat());
        d.closeChatBtn.addEventListener('click', () => this.toggleChat());
        d.sendMessage.addEventListener('click', () => this.sendChatMessage());
        d.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }

    // ==========================================
    // LOCAL MEDIA PREVIEW
    // ==========================================

    async initLocalPreview() {
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

            this.dom.localPreview.srcObject = this.localStream;
            this.dom.previewPlaceholder.classList.add('hidden');
            this.toast('Camera and microphone ready', 'success');
        } catch (err) {
            console.error('getUserMedia error:', err);
            this.toast('Cannot access camera/microphone', 'error');
            this.isVideoOn = false;
            this.isAudioOn = false;
        }
    }

    togglePreviewVideo() {
        if (!this.localStream) return;
        const track = this.localStream.getVideoTracks()[0];
        if (!track) return;

        this.isVideoOn = !this.isVideoOn;
        track.enabled = this.isVideoOn;
        this.dom.togglePreviewVideo.classList.toggle('active', this.isVideoOn);
        this.dom.previewPlaceholder.classList.toggle('hidden', this.isVideoOn);
    }

    togglePreviewAudio() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (!track) return;

        this.isAudioOn = !this.isAudioOn;
        track.enabled = this.isAudioOn;
        this.dom.togglePreviewAudio.classList.toggle('active', this.isAudioOn);
    }

    // ==========================================
    // ROOM CODE
    // ==========================================

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        this.dom.roomCode.value = code;
        this.toast('Room code generated', 'success');
    }

    async copyText(text) {
        text = (text || '').trim();
        if (!text) {
            this.toast('Nothing to copy', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            this.toast('Copied: ' + text, 'success');
        } catch {
            const tmp = document.createElement('input');
            tmp.value = text;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            tmp.remove();
            this.toast('Copied: ' + text, 'success');
        }
    }

    // ==========================================
    // JOIN ROOM (HOST / GUEST LOGIC)
    // ==========================================

    async joinRoom() {
        const name = this.dom.displayName.value.trim();
        let code = this.dom.roomCode.value.trim();

        if (!name) {
            this.toast('Please enter your name', 'error');
            this.dom.displayName.focus();
            return;
        }
        if (!code) {
            this.toast('Please enter or generate a room code', 'error');
            this.dom.roomCode.focus();
            return;
        }

        // Case-insensitive room codes
        code = code.toUpperCase().replace(/\s+/g, '');

        this.displayName = name;
        this.roomCode = code;

        this.setStatus('connecting', 'Connecting...');
        this.dom.joinRoom.disabled = true;
        this.dom.joinRoom.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

        try {
            await this.createPeerForRoom(code);
            this.showCallScreen();
        } catch (err) {
            console.error('joinRoom error:', err);
            if (err && err.message === 'ROOM_FULL') {
                this.toast('This room already has 2 people', 'error');
            } else {
                this.toast('Could not connect. Please try again.', 'error');
            }
            this.setStatus('offline', 'Disconnected');
            this.resetJoinButton();
        }
    }

    /**
     * Create a Peer as host or guest for a 2-person room.
     * Host ID:  ROOMCODE-host
     * Guest ID: ROOMCODE-guest
     */
    createPeerForRoom(code) {
        const hostId = `room-${code}-host`;
        const guestId = `room-${code}-guest`;

        return new Promise((resolve, reject) => {
            const attemptHost = () => {
                this.isHost = true;
                this.peer = new Peer(hostId, { debug: 1, config: ICE_CONFIG });

                this.peer.once('open', (id) => {
                    console.log('Connected as HOST:', id);
                    this.registerPeerHandlers();
                    this.onHostReady(hostId, guestId);
                    resolve(id);
                });

                this.peer.once('error', (err) => {
                    console.log('Host creation error:', err.type);
                    if (err.type === 'unavailable-id') {
                        // Host ID is taken -> become GUEST
                        this.peer.destroy();
                        attemptGuest();
                    } else {
                        reject(err);
                    }
                });
            };

            const attemptGuest = () => {
                this.isHost = false;
                this.peer = new Peer(guestId, { debug: 1, config: ICE_CONFIG });

                this.peer.once('open', (id) => {
                    console.log('Connected as GUEST:', id);
                    this.registerPeerHandlers();
                    this.onGuestReady(hostId);
                    resolve(id);
                });

                this.peer.once('error', (err) => {
                    console.log('Guest creation error:', err.type);
                    if (err.type === 'unavailable-id') {
                        // Both host and guest are taken -> room full
                        reject(new Error('ROOM_FULL'));
                    } else {
                        reject(err);
                    }
                });
            };

            attemptHost();
        });
    }

    onHostReady(hostId, guestId) {
        this.setStatus('online', 'Waiting for participant...');
        this.toast('Room created. Share the code: ' + this.roomCode, 'success');
        this.dom.waitingText.textContent = 'Waiting for participant...';
    }

    onGuestReady(hostId) {
        this.setStatus('online', 'Connecting to host...');
        this.dom.waitingText.textContent = 'Connecting to host...';

        // Start trying to connect to host every 2 seconds until success
        this.tryConnectToHost(hostId);
        this.guestConnectTimer = setInterval(() => {
            if (!this.isConnected) {
                this.tryConnectToHost(hostId);
            } else if (this.guestConnectTimer) {
                clearInterval(this.guestConnectTimer);
                this.guestConnectTimer = null;
            }
        }, 2000);
    }

    registerPeerHandlers() {
        this.peer.on('connection', (conn) => this.handleIncomingDataConnection(conn));
        this.peer.on('call', (call) => this.handleIncomingMediaCall(call));

        this.peer.on('disconnected', () => {
            console.log('Peer disconnected from server');
            this.setStatus('connecting', 'Reconnecting...');
            this.peer.reconnect();
        });

        this.peer.on('close', () => {
            console.log('Peer connection closed');
            this.setStatus('offline', 'Disconnected');
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
        });
    }

    tryConnectToHost(hostId) {
        if (!this.peer || this.isConnected) return;

        console.log('Attempting to connect to host:', hostId);

        const conn = this.peer.connect(hostId, {
            reliable: true,
            metadata: { name: this.displayName }
        });

        this.attachDataConnectionHandlers(conn);

        // Start media call once data connection is open (see attachDataConnectionHandlers)
    }

    // ==========================================
    // DATA CONNECTION (CHAT + SIGNALING)
    // ==========================================

    handleIncomingDataConnection(conn) {
        console.log('Incoming data connection from:', conn.peer);
        this.attachDataConnectionHandlers(conn);
    }

    attachDataConnectionHandlers(conn) {
        conn.on('open', () => {
            console.log('Data connection open with:', conn.peer);
            this.dataConn = conn;
            this.isConnected = true;

            // Get remote name from metadata if available
            this.remoteName = conn.metadata?.name || this.remoteName || 'Participant';
            this.showRemoteName();

            this.setStatus('online', 'Connected');
            this.toast(this.remoteName + ' connected!', 'success');

            // Auto-open chat
            if (!this.isChatOpen) {
                this.toggleChat(true);
            }

            // Exchange identity
            conn.send({ type: 'name', name: this.displayName });

            // If we are guest, start media call to host now
            if (!this.isHost && !this.mediaCall && this.localStream) {
                console.log('Guest initiating media call to host:', conn.peer);
                const call = this.peer.call(conn.peer, this.localStream, {
                    metadata: { name: this.displayName }
                });
                this.attachMediaCallHandlers(call);
            }

            // Stop guest retry loop
            if (this.guestConnectTimer) {
                clearInterval(this.guestConnectTimer);
                this.guestConnectTimer = null;
            }
        });

        conn.on('data', (data) => this.handleDataMessage(data));
        conn.on('close', () => this.onRemoteDisconnected());
        conn.on('error', (err) => console.error('Data connection error:', err));
    }

    handleDataMessage(data) {
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'name':
                this.remoteName = data.name || 'Participant';
                this.showRemoteName();
                break;
            case 'chat':
                this.addChatMessage(data.name || 'Guest', data.message || '', false);
                if (!this.isChatOpen) {
                    this.unreadCount++;
                    this.updateUnreadBadge();
                }
                break;
            default:
                console.log('Unknown data message:', data);
        }
    }

    // ==========================================
    // MEDIA CALL (VIDEO / AUDIO)
    // ==========================================

    handleIncomingMediaCall(call) {
        console.log('Incoming media call from:', call.peer);
        this.mediaCall = call;

        // Answer with our local stream
        if (this.localStream) {
            call.answer(this.localStream);
        } else {
            console.warn('No local stream to answer call with');
        }

        this.attachMediaCallHandlers(call);
    }

    attachMediaCallHandlers(call) {
        this.mediaCall = call;

        call.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            this.remoteStream = remoteStream;

            this.dom.remoteVideo.srcObject = remoteStream;
            this.dom.remotePlaceholder.classList.add('hidden');
            this.setStatus('online', 'In call');
            this.toast('Video connected!', 'success');
        });

        call.on('close', () => {
            console.log('Media call closed');
            this.onRemoteDisconnected();
        });

        call.on('error', (err) => {
            console.error('Media call error:', err);
        });
    }

    onRemoteDisconnected() {
        console.log('Remote disconnected');

        this.isConnected = false;
        this.dataConn = null;
        this.mediaCall = null;
        this.remoteStream = null;
        this.remoteName = '';

        this.dom.remoteVideo.srcObject = null;
        this.dom.remotePlaceholder.classList.remove('hidden');
        this.dom.remoteName.classList.remove('visible');
        this.dom.waitingText.textContent = 'Waiting for participant...';

        // If host, stay in room and wait for new participant
        if (this.isHost && this.peer && !this.peer.destroyed) {
            this.setStatus('online', 'Waiting for participant...');
        } else {
            this.setStatus('online', 'Waiting...');
        }

        this.toast('Participant disconnected', 'info');
    }

    showRemoteName() {
        if (!this.remoteName) return;
        this.dom.remoteName.textContent = this.remoteName;
        this.dom.remoteName.classList.add('visible');
    }

    // ==========================================
    // UI: SCREENS & STATUS
    // ==========================================

    showCallScreen() {
        this.dom.setupScreen.classList.add('hidden');
        this.dom.callScreen.classList.remove('hidden');

        this.dom.currentRoomCode.textContent = this.roomCode;
        this.dom.displayRoomCode.textContent = this.roomCode;

        if (this.localStream) {
            this.dom.localVideo.srcObject = this.localStream;
            this.dom.localPlaceholder.classList.toggle('hidden', this.isVideoOn);
        }

        this.resetJoinButton();
    }

    showSetupScreen() {
        this.dom.callScreen.classList.add('hidden');
        this.dom.setupScreen.classList.remove('hidden');
    }

    setStatus(status, text) {
        const dot = this.dom.connectionStatus.querySelector('.status-dot');
        const label = this.dom.connectionStatus.querySelector('.status-text');

        dot.className = 'status-dot ' + status;
        label.textContent = text;
    }

    resetJoinButton() {
        this.dom.joinRoom.disabled = false;
        this.dom.joinRoom.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Room';
    }

    // ==========================================
    // CAMERA / MIC / SCREEN DURING CALL
    // ==========================================

    toggleVideo() {
        if (!this.localStream) return;
        const track = this.localStream.getVideoTracks()[0];
        if (!track) return;

        this.isVideoOn = !this.isVideoOn;
        track.enabled = this.isVideoOn;

        this.dom.toggleVideo.dataset.active = String(this.isVideoOn);
        this.dom.toggleVideo.querySelector('i').className =
            this.isVideoOn ? 'fas fa-video' : 'fas fa-video-slash';
        this.dom.localPlaceholder.classList.toggle('hidden', this.isVideoOn);
    }

    toggleAudio() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (!track) return;

        this.isAudioOn = !this.isAudioOn;
        track.enabled = this.isAudioOn;

        this.dom.toggleAudio.dataset.active = String(this.isAudioOn);
        this.dom.toggleAudio.querySelector('i').className =
            this.isAudioOn ? 'fas fa-microphone' : 'fas fa-microphone-slash';
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

            if (this.mediaCall?.peerConnection) {
                const sender = this.mediaCall.peerConnection
                    .getSenders()
                    .find((s) => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
            }

            this.dom.localVideo.srcObject = this.screenStream;

            screenTrack.onended = () => this.stopScreenShare();

            this.isScreenSharing = true;
            this.dom.toggleScreenShare.classList.add('active-share');
            this.toast('Screen sharing started', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Screen share error:', err);
                this.toast('Could not share screen', 'error');
            }
        }
    }

    async stopScreenShare() {
        if (!this.screenStream) return;

        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;

        if (this.mediaCall?.peerConnection && this.localStream) {
            const camTrack = this.localStream.getVideoTracks()[0];
            if (camTrack) {
                const sender = this.mediaCall.peerConnection
                    .getSenders()
                    .find((s) => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(camTrack);
                }
            }
        }

        this.dom.localVideo.srcObject = this.localStream;
        this.isScreenSharing = false;
        this.dom.toggleScreenShare.classList.remove('active-share');
        this.toast('Screen sharing stopped', 'info');
    }

    // ==========================================
    // CHAT
    // ==========================================

    toggleChat(forceOpen = null) {
        if (typeof forceOpen === 'boolean') {
            this.isChatOpen = forceOpen;
        } else {
            this.isChatOpen = !this.isChatOpen;
        }

        this.dom.chatPanel.classList.toggle('hidden', !this.isChatOpen);
        this.dom.toggleChatBtn.classList.toggle('chat-active', this.isChatOpen);

        if (this.isChatOpen) {
            this.unreadCount = 0;
            this.updateUnreadBadge();
            this.dom.messageInput.focus();
        }
    }

    updateUnreadBadge() {
        if (this.unreadCount > 0) {
            this.dom.unreadBadge.textContent =
                this.unreadCount > 9 ? '9+' : String(this.unreadCount);
            this.dom.unreadBadge.classList.remove('hidden');
        } else {
            this.dom.unreadBadge.classList.add('hidden');
        }
    }

    sendChatMessage() {
        const text = this.dom.messageInput.value.trim();
        if (!text) return;

        if (!this.dataConn || !this.dataConn.open) {
            this.toast('Not connected yet', 'error');
            return;
        }

        const msg = {
            type: 'chat',
            name: this.displayName,
            message: text
        };

        this.dataConn.send(msg);
        this.addChatMessage(this.displayName, text, true);
        this.dom.messageInput.value = '';
    }

    addChatMessage(sender, text, isOwn) {
        if (this.dom.chatEmpty) {
            this.dom.chatEmpty.classList.add('hidden');
        }

        const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const msgEl = document.createElement('div');
        msgEl.className = 'message' + (isOwn ? ' own' : '');
        msgEl.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${isOwn ? 'You' : this.escape(sender)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escape(text)}</div>
        `;

        this.dom.chatMessages.appendChild(msgEl);
        this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==========================================
    // END CALL / CLEANUP
    // ==========================================

    endCall() {
        this.cleanupConnections();
        this.showSetupScreen();
        this.setStatus('offline', 'Disconnected');
        this.toast('Call ended', 'info');

        // Reset call UI
        this.dom.remoteVideo.srcObject = null;
        this.dom.remotePlaceholder.classList.remove('hidden');
        this.dom.remoteName.classList.remove('visible');
        this.dom.waitingText.textContent = 'Waiting for participant...';

        // Reset chat
        this.dom.chatPanel.classList.add('hidden');
        this.dom.toggleChatBtn.classList.remove('chat-active');
        this.isChatOpen = false;
        this.unreadCount = 0;
        this.updateUnreadBadge();

        this.dom.chatMessages.innerHTML = `
            <div class="chat-empty" id="chatEmpty">
                <i class="fas fa-comment-dots"></i>
                <p>No messages yet</p>
            </div>
        `;
        this.dom.chatEmpty = document.getElementById('chatEmpty');

        // Reset controls UI
        this.dom.toggleScreenShare.classList.remove('active-share');
        this.dom.toggleVideo.dataset.active = 'true';
        this.dom.toggleVideo.querySelector('i').className = 'fas fa-video';
        this.dom.toggleAudio.dataset.active = 'true';
        this.dom.toggleAudio.querySelector('i').className = 'fas fa-microphone';

        // Keep local camera stream for preview; no need to reacquire
        this.dom.localPreview.srcObject = this.localStream;
        this.dom.previewPlaceholder.classList.toggle('hidden', !!this.localStream && this.isVideoOn);
    }

    cleanupConnections() {
        if (this.guestConnectTimer) {
            clearInterval(this.guestConnectTimer);
            this.guestConnectTimer = null;
        }

        if (this.screenStream) {
            this.screenStream.getTracks().forEach((t) => t.stop());
            this.screenStream = null;
            this.isScreenSharing = false;
        }

        if (this.dataConn) {
            try { this.dataConn.close(); } catch {}
            this.dataConn = null;
        }

        if (this.mediaCall) {
            try { this.mediaCall.close(); } catch {}
            this.mediaCall = null;
        }

        if (this.peer) {
            try { this.peer.destroy(); } catch {}
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
        toast.className = `toast ${type}`;

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

        this.dom.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// ==========================================
// BOOTSTRAP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConnectHub();
});