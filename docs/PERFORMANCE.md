# Performance — prayer-earth

How the Joining Palms app stays fast on phones and desktop. This documents
*what* is optimized and *why*; it is not a security document (see
`sync-engine/docs/SECURITY.md` for that).

## Bundle & loading

The single biggest lever is **code-splitting**. The app ships almost nothing
until it is actually needed:

| What loads | When |
|---|---|
| App shell + React + metadata | immediately |
| Per-tradition prayer texts (3–24 KB × 15) | when that tradition is opened |
| Prayer view, Earth view, Legal page | on navigation |
| Settings, onboarding, prayer picker, keyboard help, toast | on interaction |
| Speech engine (~27 KB) | on first play |
| three.js (~471 KB) | on first Earth/prayer interaction |

Result: the entry bundle went from ~448 KB to ~165 KB over the life of the
project. hashed assets are served with `immutable` cache headers, so repeat
visits (and the service worker) skip re-downloading unchanged code entirely.

## Rendering (React)

- The Zustand store's high-frequency setters (live prayer/spirit counts,
  lights) use **shallow-equality guards** — a presence tick that carries
  unchanged data notifies *zero* subscribers, so nothing re-renders.
- Hot, always-mounted components (Nav, WorldFeed, picker rows) are wrapped in
  `React.memo`.
- Components subscribe to the specific value they need (e.g. one prayer's
  count) rather than a whole object that changes on every update.
- Derived lists are memoized; keyboard listeners are attached once, not on
  every slider drag.

## WebGL / Earth

- The scene is fully **disposed** on unmount (geometries, materials, textures,
  context) — repeated navigation no longer leaks GPU memory.
- Prayer-light positions are **precomputed once**; the per-frame loop no longer
  recomputes 256 world matrices.
- Rendering is driven by the scene's own `requestAnimationFrame` loop — no
  React force-re-render intervals.
- The land/ocean boundary is a **dedicated mask texture** loaded once (not
  per-pixel RGB classification at runtime), and its light-snap grid is cached
  at module scope so the flood-fill runs a single time.

## Slower devices

- **Low-power detection** (`hardwareConcurrency` ≤ 4): fewer sphere segments,
  antialiasing off, capped pixel ratio, fewer particles and motes.
- **`prefers-reduced-motion` is handled separately** — users who ask for less
  motion get a still globe with *full* visual quality (resolution is not
  degraded for them, which was an earlier mistake).
- **Half-res assets**: the prayer-view backdrop uses a ~70 KB texture instead
  of the full ~180 KB map; the mask is pre-generated offline.
- **Graceful degradation everywhere**: WebGL failure shows a calm fallback
  screen; no speech voice falls back to a soft chant; no precise location
  falls back to a coarse timezone anchor; storage/quota errors are swallowed
  so state never crashes.

## Caching

- `/assets/*` (content-hashed) → `immutable`, one-year cache.
- `/audio/*` → cached 30 days (regenerated in place; CDN purged on update).
- Service worker → offline and instant repeat loads.

## Regenerating the land mask

The Earth's coastline mask is `public/land-mask.png`:

```bash
node scripts/generate-land-mask.mjs                    # from the day texture
node scripts/generate-land-mask.mjs --source mask.png  # from your own raster
```

For pixel-perfect coastlines, generate from authoritative data (e.g. Natural
Earth land polygons) via `--source`.
