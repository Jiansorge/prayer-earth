// sync-engine — the app-side interface.
// Any app that wants real-time presence/broadcast implements nothing here; it
// depends only on this small surface. Two implementations exist:
//   1. WsEngine   — talks to a plain WebSocket server (Prayer Earth's Node
//                   server today, and the reference implementation).
//   2. CfEngine   — talks to the Cloudflare Workers + Durable Objects engine
//                   (in progress; the wire protocol is identical).
// Swapping the engine never changes app code.

export class SyncEngine {
  constructor() {
    this.sock = null
    this.onMessage = null
    this.onStatus = null
  }

  connect(url) {
    this.disconnect()
    try {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      this.sock = new WebSocket(url || `${proto}://${window.location.host}`)
      this.sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (this.onMessage) this.onMessage(msg)
        } catch {}
      }
      this.sock.onopen = () => {
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
// keepalive differ. Apps never import this directly.
export class CfEngine extends SyncEngine {
  connect(url) {
    super.connect(url)
    clearInterval(this._ping)
    this._ping = setInterval(() => this.send({ type: 'ping' }), 15000)
  }
  disconnect() {
    clearInterval(this._ping)
    super.disconnect()
  }
}
