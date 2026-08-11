// sync-engine — the app-side interface.
// Any app that wants real-time presence/broadcast implements nothing here; it
// depends only on this small surface. Two implementations exist:
//   1. WsEngine   — talks to a plain WebSocket server (Prayer Earth's Node
//                   server today, and the reference implementation).
//   2. CfEngine   — talks to the Cloudflare Workers + Durable Objects engine
//                   (same wire protocol; adds its own keepalive).
// Swapping the engine never changes app code.

import { C_PING, E_PONG } from './protocol.js'

// CfEngine keepalive + liveness policy.
const PING_EVERY_MS = 20000
const STALE_AFTER_MS = 60000

// Cap on a single inbound frame. The engine never sends anything close to
// this (its own limits keep feeds bounded and syncs tiny), so a frame this
// big is hostile (or a broken/mitm'd server) — the client drops it rather
// than JSON.parse it into unbounded work. 256 KB is generous for any legit
// state/feed/sync payload at any scale.
const MAX_FRAME = 256 * 1024

export class SyncEngine {
  constructor() {
    this.sock = null
    this.onMessage = null
    this.onStatus = null
    this._lastPong = 0
  }

  connect(url) {
    this.disconnect()
    try {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      this.sock = new WebSocket(url || `${proto}://${window.location.host}`)
      this.sock.onmessage = (ev) => {
        try {
          // Reject oversized frames before any parsing — a hostile or mitm'd
          // server must not be able to push unbounded data into the tab.
          if (typeof ev.data === 'string' && ev.data.length > MAX_FRAME) return
          const msg = JSON.parse(ev.data)
          // Engine-level liveness: consume pongs here, never forward them.
          if (msg.type === E_PONG) {
            this._lastPong = Date.now()
            return
          }
          if (this.onMessage) this.onMessage(msg)
        } catch {}
      }
      this.sock.onopen = () => {
        this._lastPong = Date.now()
        if (this.onStatus) this.onStatus(true)
      }
      this.sock.onclose = () => {
        this.sock = null
        if (this.onStatus) this.onStatus(false)
      }
      this.sock.onerror = () => {
        try {
          this.sock.close()
        } catch {}
      }
    } catch {
      if (this.onStatus) this.onStatus(false)
    }
  }

  send(obj) {
    if (this.sock && this.sock.readyState === WebSocket.OPEN) {
      this.sock.send(JSON.stringify(obj))
      return true
    }
    return false
  }

  disconnect() {
    if (this.sock) {
      this.sock.onopen = null
      this.sock.onmessage = null
      this.sock.onclose = null
      this.sock.onerror = null
      try {
        this.sock.close()
      } catch {}
      this.sock = null
    }
  }
}

// The Cloudflare engine talks the same protocol — only the URL scheme and the
// keepalive differ. It probes with C_PING and treats a missing E_PONG as a
// dead socket, so a hung connection gets detected and re-established instead
// of silently sitting open. Apps never import this directly.
export class CfEngine extends SyncEngine {
  connect(url) {
    super.connect(url)
    clearInterval(this._keep)
    this._lastPong = Date.now()
    this._keep = setInterval(() => {
      if (!this.sock) return
      if (Date.now() - this._lastPong > STALE_AFTER_MS) {
        this.disconnect()
        if (this.onStatus) this.onStatus(false)
        return
      }
      this.send({ type: C_PING })
    }, PING_EVERY_MS)
  }
  disconnect() {
    clearInterval(this._keep)
    super.disconnect()
  }
}
