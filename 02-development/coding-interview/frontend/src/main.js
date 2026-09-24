import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import './styles.css';

const configuredApi = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const api =
  configuredApi ||
  (location.port === '5173'
    ? `${location.protocol}//${location.hostname}:8001`
    : '');
const wsApi = api
  ? api.replace(/^http/, 'ws')
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const sessionId = location.pathname.split('/').pop();
const peerId = crypto.randomUUID
  ? crypto.randomUUID()
  : `peer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let socket;
let timer;
let localStream;
let lastCallState = 'idle';
const peerConnections = new Map();
const pendingCandidates = new Map();
let reconnectTimer;

const app = document.querySelector('#app');

function showError(error) {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const nextStep = isLocal
    ? 'Start the application with <code>npm.cmd run dev</code> from the PairPad project folder. This starts FastAPI on port 8001 and Vite on port 5173.'
    : 'Configure the Vercel <code>VITE_API_URL</code> environment variable with the public URL of the running FastAPI backend, then redeploy.';

  app.innerHTML = `
    <main class="error-state">
      <p class="eyebrow">PairPad</p>
      <h1>PairPad could not connect.</h1>
      <p class="muted">${error.message}</p>
      <p class="muted">${nextStep}</p>
      <button class="new-room" id="retry">Try again</button>
    </main>
  `;

  document.querySelector('#retry').onclick = () => location.reload();
}

async function pythonRuntime() {
  const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/';

  if (globalThis.loadPyodide) {
    return globalThis.loadPyodide({ indexURL });
  }

  await new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = `${indexURL}pyodide.js`;
    tag.onload = resolve;
    tag.onerror = reject;
    document.head.append(tag);
  });

  return globalThis.loadPyodide({ indexURL });
}

async function create() {
  const response = await fetch(`${api}/api/sessions`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}.`);
  }
  const session = await response.json();
  location.href = `/session/${session.id}`;
}

function setCallState(label) {
  const state = document.querySelector('#call-status');
  if (state) {
    state.textContent = label;
  }
  lastCallState = label;
}

function setStatus(label, tone = 'ok') {
  const status = document.querySelector('#status');
  if (status) {
    status.textContent = label;
    status.dataset.tone = tone;
  }
}

function describeMediaError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Camera or microphone permission was denied. Allow access in browser settings and try again.';
  }
  if (error?.name === 'NotFoundError') {
    return 'No camera or microphone was found on this device.';
  }
  return `Unable to access the camera or microphone: ${error?.message || 'unknown error'}`;
}

function ensurePeerConnection(remotePeerId) {
  if (peerConnections.has(remotePeerId)) {
    return peerConnections.get(remotePeerId);
  }

  const pendingPc = peerConnections.get('pending-call');
  if (pendingPc && remotePeerId !== 'pending-call') {
    peerConnections.delete('pending-call');
    peerConnections.set(remotePeerId, pendingPc);
    return pendingPc;
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.ontrack = (event) => {
    const [remoteStream] = event.streams;
    const video = document.querySelector('#remote-video');
    if (video && remoteStream) {
      video.srcObject = remoteStream;
      video.play().catch(() => {
        setCallState('Remote video is ready. Click the video to start audio.');
      });
    }
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    sendSignal('candidate', { candidate: event.candidate.toJSON() });
  };

  pc.onconnectionstatechange = () => {
    const state = document.querySelector('#call-status');
    if (!state) return;

    if (pc.connectionState === 'connected') {
      state.textContent = 'WebRTC call connected.';
    } else if (pc.connectionState === 'connecting') {
      state.textContent = 'Connecting WebRTC call…';
    } else if (pc.connectionState === 'failed') {
      state.textContent = 'WebRTC connection failed. Try again.';
    }
  };

  peerConnections.set(remotePeerId, pc);
  return pc;
}

function addLocalTracks(pc) {
  if (!localStream) return;

  localStream.getTracks().forEach((track) => {
    if (!pc.getSenders().some((sender) => sender.track === track)) {
      pc.addTrack(track, localStream);
    }
  });
}

async function requestLocalMedia() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  }

  const localVideo = document.querySelector('#local-video');
  if (localVideo) {
    localVideo.srcObject = localStream;
  }
}

function endCall() {
  for (const pc of peerConnections.values()) {
    pc.close();
  }
  peerConnections.clear();
  pendingCandidates.clear();

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = undefined;
  }

  const localVideo = document.querySelector('#local-video');
  const remoteVideo = document.querySelector('#remote-video');
  if (localVideo) localVideo.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
  setCallState('Call ended. Start a new call when ready.');
  document.querySelector('#call').hidden = false;
  document.querySelector('#end-call').hidden = true;
  document.querySelector('#toggle-mic').disabled = true;
  document.querySelector('#toggle-camera').disabled = true;
}

async function sendSignal(signalType, payload, remotePeerId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: 'webrtc-signal',
      peerId,
      remotePeerId,
      signalType,
      ...payload,
    }),
  );
}

async function beginCall() {
  if (!('RTCPeerConnection' in window) || !navigator.mediaDevices?.getUserMedia) {
    setCallState('This browser does not support WebRTC camera calls.');
    return;
  }

  const nativeCallState = document.querySelector('#call-status');

  try {
    await requestLocalMedia();

    const pc = ensurePeerConnection('pending-call');
    addLocalTracks(pc);

    if (pc.signalingState === 'stable') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('offer', { offer: pc.localDescription.toJSON() });
      document.querySelector('#call').hidden = true;
      document.querySelector('#end-call').hidden = false;
      document.querySelector('#toggle-mic').disabled = false;
      document.querySelector('#toggle-camera').disabled = false;
      nativeCallState.textContent = 'Sending WebRTC offer…';
    }
  } catch (error) {
    console.error(error);
    setCallState(describeMediaError(error));
  }
}

async function handleSignal(data) {
  if (!data || data.peerId === peerId || !data.signalType) {
    return;
  }

  const remotePeerId = data.peerId;
  const pc = ensurePeerConnection(remotePeerId);

  if (data.signalType === 'offer') {
    await requestLocalMedia();
    addLocalTracks(pc);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    await flushPendingCandidates(remotePeerId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal('answer', { answer: pc.localDescription.toJSON() }, remotePeerId);
    document.querySelector('#call').hidden = true;
    document.querySelector('#end-call').hidden = false;
    document.querySelector('#toggle-mic').disabled = false;
    document.querySelector('#toggle-camera').disabled = false;
    setCallState('WebRTC call connected.');
    return;
  }

  if (data.signalType === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    await flushPendingCandidates(remotePeerId, pc);
    setCallState('WebRTC call connected.');
    return;
  }

  if (data.signalType === 'candidate' && data.candidate) {
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        const candidates = pendingCandidates.get(remotePeerId) || [];
        candidates.push(data.candidate);
        pendingCandidates.set(remotePeerId, candidates);
      }
    } catch (error) {
      console.warn('Unable to add ICE candidate.', error);
    }
  }
}

async function flushPendingCandidates(remotePeerId, pc) {
  const candidates = pendingCandidates.get(remotePeerId) || [];
  pendingCandidates.delete(remotePeerId);

  for (const candidate of candidates) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

function render(session) {
  app.innerHTML = `
    <main class="app-shell">
      <header class="app-header">
        <div class="brand-copy">
          <p class="eyebrow">PairPad</p>
          <h1>Code together.<span>Think clearly.</span></h1>
          <p class="muted">A focused interview room with browser-only code execution.</p>
        </div>
        <button class="new-room" id="new">New room</button>
      </header>
      <section class="room">
        <aside class="room-sidebar">
          <span class="live">● Live collaboration</span>
          <h2>Interview room</h2>
          <p class="muted">Share this URL with your candidate.</p>
          <button class="copy" id="copy">Copy room link</button>
          <hr>
          <div class="video-panel">
            <div class="video-grid">
              <div class="video-tile">
                <video id="local-video" autoplay muted playsinline></video>
                <span>You</span>
              </div>
              <div class="video-tile">
                <video id="remote-video" autoplay playsinline></video>
                <span>Remote participant</span>
              </div>
            </div>
            <div class="call-actions">
              <button class="call" id="call">Start video call</button>
              <button class="call secondary" id="end-call" hidden>End call</button>
            </div>
            <div class="media-actions">
              <button class="media-toggle" id="toggle-mic" disabled>Mute mic</button>
              <button class="media-toggle" id="toggle-camera" disabled>Disable camera</button>
            </div>
            <p class="call-status" id="call-status">Waiting for another participant.</p>
          </div>
          <hr>
          <label>
            Language
            <select id="language">
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          </label>
          <button class="run" id="run">Run in browser</button>
          <pre id="output">Ready to run safely in this browser.</pre>
        </aside>
        <section class="editor">
          <div class="editor-bar">
            <strong class="file-name">solution.${session.language === 'python' ? 'py' : 'js'}</strong>
            <span class="connection-status" id="status">Connected</span>
          </div>
          <div class="code-wrap">
            <pre id="highlight"><code></code></pre>
            <textarea id="code" spellcheck="false"></textarea>
          </div>
        </section>
      </section>
    </main>
  `;

  const code = document.querySelector('#code');
  const language = document.querySelector('#language');
  const highlightedCode = document.querySelector('#highlight code');
  document.querySelector('.live').textContent = 'Live collaboration';

  code.value = session.code;
  language.value = session.language;

  const paint = () => {
    highlightedCode.className = `language-${language.value}`;
    highlightedCode.innerHTML = Prism.highlight(
      code.value,
      Prism.languages[language.value],
      language.value,
    );
  };

  paint();

  code.onscroll = () => {
    highlightedCode.parentElement.scrollTop = code.scrollTop;
    highlightedCode.parentElement.scrollLeft = code.scrollLeft;
  };

  document.querySelector('#new').onclick = create;
  document.querySelector('#copy').onclick = () =>
    navigator.clipboard.writeText(location.href);
  document.querySelector('#call').onclick = beginCall;
  document.querySelector('#end-call').onclick = endCall;
  document.querySelector('#toggle-mic').onclick = () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    document.querySelector('#toggle-mic').textContent = track.enabled ? 'Mute mic' : 'Unmute mic';
  };
  document.querySelector('#toggle-camera').onclick = () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    document.querySelector('#toggle-camera').textContent = track.enabled
      ? 'Disable camera'
      : 'Enable camera';
  };
  document.querySelector('#remote-video').onclick = () =>
    document.querySelector('#remote-video').play().catch(() => {});

  code.oninput = () => {
    paint();
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        socket?.send(
          JSON.stringify({
            type: 'update',
            code: code.value,
            language: language.value,
          }),
        ),
      250,
    );
  };

  language.onchange = () => {
    paint();
    socket?.send(
      JSON.stringify({
        type: 'update',
        code: code.value,
        language: language.value,
      }),
    );
  };

  document.querySelector('#run').onclick = async () => {
    const output = document.querySelector('#output');
    output.textContent = 'Running…';

    try {
      if (language.value === 'javascript') {
        output.textContent = String(
          Function(`"use strict";${code.value}`)() ?? 'Finished.',
        );
      } else {
        const py = await pythonRuntime();
        output.textContent = String(
          (await py.runPythonAsync(code.value)) ?? 'Finished.',
        );
      }
    } catch (error) {
      output.textContent = `Error: ${error.message}`;
    }
  };

  socket = new WebSocket(`${wsApi}/ws/sessions/${session.id}`);
  socket.onopen = () => setStatus('Collaboration connected', 'ok');
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'document' && data.code !== code.value) {
      code.value = data.code;
      language.value = data.language;
      paint();
      return;
    }

    if (data.type === 'webrtc-signal') {
      handleSignal(data).catch((error) => {
        console.warn('Unable to process WebRTC signal.', error);
      });
    }
  };
  socket.onclose = () => {
    setStatus('Collaboration disconnected; retrying…', 'error');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => location.reload(), 2000);
  };
  socket.onerror = () => setStatus('Collaboration connection error', 'error');
}

if (!sessionId || sessionId === '') {
  create().catch(showError);
} else {
  fetch(`${api}/api/sessions/${sessionId}`)
    .then((response) => {
      if (response.ok) {
        return response.json();
      }

      return create();
    })
    .then(render)
    .catch(showError);
}
