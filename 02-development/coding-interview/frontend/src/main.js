import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import './styles.css';

const configuredApi = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const api =
  configuredApi ||
  (location.port === '5173'
    ? `${location.protocol}//${location.hostname}:8000`
    : '');
const wsApi = api
  ? api.replace(/^http/, 'ws')
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const sessionId = location.pathname.split('/').pop();
let socket;
let timer;

const app = document.querySelector('#app');

function showError(error) {
  app.innerHTML = `
    <main class="error-state">
      <p class="eyebrow">PairPad</p>
      <h1>PairPad could not connect.</h1>
      <p class="muted">${error.message}</p>
      <p class="muted">
        Configure the Vercel <code>VITE_API_URL</code> environment variable
        with the public URL of the running FastAPI backend, then redeploy.
      </p>
    </main>
  `;
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

function render(session) {
  app.innerHTML = `
    <main>
      <header>
        <div>
          <p class="eyebrow">PairPad</p>
          <h1>Code together. Think clearly.</h1>
          <p class="muted">A shared interview room with browser-only execution.</p>
        </div>
        <button id="new">New room</button>
      </header>
      <section class="room">
        <aside>
          <span class="live">● Live collaboration</span>
          <h2>Interview room</h2>
          <p class="muted">Share this URL with your candidate.</p>
          <button class="copy" id="copy">Copy room link</button>
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
            <strong>solution.${session.language === 'python' ? 'py' : 'js'}</strong>
            <span id="status">Connected</span>
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

  document.querySelector('#new').onclick = create;
  document.querySelector('#copy').onclick = () =>
    navigator.clipboard.writeText(location.href);

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
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'document' && data.code !== code.value) {
      code.value = data.code;
      language.value = data.language;
      paint();
    }
  };
  socket.onclose = () => {
    document.querySelector('#status').textContent = 'Reconnecting…';
  };
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
