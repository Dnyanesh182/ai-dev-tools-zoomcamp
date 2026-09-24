# PairPad product specification

## User stories

- As an interviewer, I can create a session and share its URL with a candidate.
- As a participant, I can edit JavaScript or Python code and see edits from others in real time.
- As a participant, I can launch a WebRTC camera call inside the room while collaborating on code.
- As a participant, I can run code in my browser without sending it to the server for execution.

## Acceptance criteria

- Creating a session returns a persistent shareable URL.
- Two WebSocket clients receive an updated document after either client edits it.
- JavaScript and Python code have syntax highlighting; Python runs with Pyodide in the browser.
- Two participants in the same room can exchange WebRTC signaling and establish a live camera call through the browser.

## Non-goals

Authentication, user cursors, server-side code execution, and production deployment credentials.
