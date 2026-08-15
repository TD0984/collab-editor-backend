/**
 * Represents one collaboratively-edited document.
 *
 * Ordering strategy (intermediate, not full CRDT):
 *  - The server assigns a monotonically increasing `version` (sequence
 *    number) to every op it applies. This is the authoritative total order.
 *  - Clients tag each op with `baseVersion` = the version they last saw.
 *  - If a client's op arrives stale (baseVersion < current version), the
 *    server transforms the op's position against every op applied since
 *    baseVersion, so it lands in the right place in the *current* doc,
 *    instead of rejecting it or corrupting the text.
 *  - Each op also carries the client's Lamport clock, logged for causal
 *    ordering/debugging and to break position ties deterministically.
 */
export class Document {
  constructor(docId, initialContent = '') {
    this.docId = docId;
    this.content = initialContent;
    this.version = 0;
    // Append-only log of applied ops: { seq, clientId, lamportClock, op }
    this.opLog = [];
  }

  /**
   * Transform a single op's position against one already-applied op.
   * Handles insert/delete on a flat string buffer.
   */
  static transform(op, against) {
    const transformed = { ...op };

    if (against.type === 'insert') {
      if (against.pos < transformed.pos ||
         (against.pos === transformed.pos && Document.winsTie(against, transformed))) {
        transformed.pos += against.text.length;
      }
    } else if (against.type === 'delete') {
      if (against.pos < transformed.pos) {
        transformed.pos = Math.max(against.pos, transformed.pos - against.length);
      }
    }
    return transformed;
  }

  /**
   * Deterministic tie-break for two ops that touch the same position:
   * lower Lamport clock wins; if equal, lower clientId wins (string compare).
   * Every replica computes this the same way, so ordering never diverges.
   */
  static winsTie(a, b) {
    if (a.lamportClock !== b.lamportClock) return a.lamportClock < b.lamportClock;
    return a.clientId < b.clientId;
  }

  /**
   * Apply an incoming op from a client.
   * `baseVersion` tells us how stale the client's view was.
   * Returns the transformed op that was actually applied, plus new version.
   */
  applyOp({ clientId, lamportClock, baseVersion, op }) {
    let workingOp = { ...op, clientId, lamportClock };

    // Rebase against every op the client hadn't seen yet.
    const missed = this.opLog.slice(baseVersion);
    for (const entry of missed) {
      workingOp = Document.transform(workingOp, entry.op);
    }

    this.#mutate(workingOp);
    this.version += 1;
    this.opLog.push({ seq: this.version, clientId, lamportClock, op: workingOp });

    return { appliedOp: workingOp, version: this.version };
  }

  #mutate(op) {
    if (op.type === 'insert') {
      const pos = Math.max(0, Math.min(op.pos, this.content.length));
      this.content = this.content.slice(0, pos) + op.text + this.content.slice(pos);
    } else if (op.type === 'delete') {
      const pos = Math.max(0, Math.min(op.pos, this.content.length));
      const end = Math.min(pos + op.length, this.content.length);
      this.content = this.content.slice(0, pos) + this.content.slice(end);
    } else {
      throw new Error(`Unknown op type: ${op.type}`);
    }
  }
}