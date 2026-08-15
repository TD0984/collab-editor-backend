import { Document } from './document.js';

/**
 * Wires the ordering/conflict-resolution logic into the connection layer's
 * onJoin/onOp hooks. Keeps one Document instance per docId.
 */
export function createOrderingLayer() {
  const docs = new Map(); // docId -> Document

  function getDoc(docId) {
    if (!docs.has(docId)) docs.set(docId, new Document(docId));
    return docs.get(docId);
  }

  function handleJoin({ clientId, docId, send }) {
    const doc = getDoc(docId);
    send(clientId, {
      type: 'init',
      docId,
      content: doc.content,
      version: doc.version,
      clientId,
    });
  }

  function handleOp({ clientId, docId, op, send, broadcast }) {
    const doc = getDoc(docId);

    if (typeof op?.baseVersion !== 'number' || typeof op?.lamportClock !== 'number') {
      return send(clientId, { type: 'error', message: 'op requires baseVersion and lamportClock' });
    }

    let result;
    try {
      result = doc.applyOp({
        clientId,
        lamportClock: op.lamportClock,
        baseVersion: op.baseVersion,
        op: { type: op.type, pos: op.pos, text: op.text, length: op.length },
      });
    } catch (err) {
      return send(clientId, { type: 'error', message: err.message });
    }

    const message = {
      type: 'op',
      docId,
      op: result.appliedOp,
      version: result.version,
      from: clientId,
    };

    broadcast(docId, message, {});
  }

  return { handleJoin, handleOp, getDoc };
}