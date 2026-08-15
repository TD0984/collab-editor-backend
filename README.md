# Collaborative Editing Backend

A real-time backend server for collaborative text editing — the kind of system
that powers tools like Google Docs — built with **Node.js** and **WebSockets**.

## What it does

Multiple clients can connect to the server and edit the same shared document
at the same time. As edits arrive, the server resolves conflicts and ensures
every connected client converges on the exact same final document, even when
edits are sent concurrently or arrive out of order due to network delays.

## How it works

- **WebSocket connection layer** (`src/server.js`): manages persistent
  client connections, per-document rooms, message broadcasting, and
  heartbeat-based detection of dropped connections.

- **Conflict resolution layer** (`src/document.js`, `src/ordering.js`):
  the server maintains a single authoritative version of each document.
  Every operation is tagged with the client's last-known document version
  and a Lamport logical clock. If an operation arrives based on a stale
  version, the server transforms its position against all operations
  applied since — rebasing it into the correct place in the current
  document instead of corrupting it or discarding it. This gives
  deterministic, sequence-number-based conflict resolution without
  implementing a full CRDT or OT engine.

## Why this approach

Real collaborative editors (Google Docs, Notion, etc.) typically use
Operational Transformation or CRDTs to handle concurrent edits. This
project implements a lighter-weight but conceptually related approach:
server-authoritative sequencing with logical clocks for deterministic
tie-breaking. It solves the same core problem — concurrent edits from
multiple clients converging to one correct document — with a simpler,
fully explainable mechanism.

## Tech stack

Node.js, `ws` (WebSocket library), vanilla JavaScript (ES modules).

## Running locally

```bash
npm install
npm run start          # starts the server on :8080
node test/client.js    # run in a separate terminal to simulate a client
```
