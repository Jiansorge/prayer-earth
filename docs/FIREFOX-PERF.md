# Diagnosing the Firefox / LibreWolf lag

Everything here is something you can do without me, and each step rules something
out. Do them in order and stop at the first one that reproduces it.

## 0. Confirm it is the app and not the browser

Firefox's own performance profiler will say whether the time is in our code, in
Firefox's compositor, or in a GPU driver:

- Open `about:performance`
- Click **Record**, then reproduce the slow scrolling for ~10 seconds
- Stop, and look at the **Frames** panel

What we are looking for:

- **Long green/purple bars attributed to `main` while scrolling** - it is our
  script, and the fire-and-forget / long-task audit points at the likely places
- **Time attributed to "Idle" or to the compositor** - it is not us
- **`about:support` → "Compositing" → "Window protocol"** should say `WebRender`.
  If it says `Basic` or WebRender is disabled, that changes the diagnosis
  entirely.

`about:config` → `gfx.webrender.all` and `layers.acceleration.disabled` are worth
a look if the compositor looks wrong.

## 1. Test with a profile that has nothing else in it

A fresh profile is the single most useful control, because it removes extensions,
which are the most common cause of "this one browser is slow":

- `about:profiles` → create a new profile, **with default extensions off**
- Load the Earth page in it

If the lag is gone, it was an extension or a privacy extension fighting the canvas.
LibreWolf ships with several by design.

## 2. Rule out our own known costs

We already measured this, and the result is worth repeating because it argues
against the app being the cause:

- With a real GPU rasteriser the home page runs **144fps idle, 140fps scrolling,
  zero dropped frames**
- Under headless software rasterisation the same build showed **15fps**, which is
  why I could not reproduce it here

So the honest position is: **there is no frame-rate bug we can find with the tools
available on this machine.** If Firefox is genuinely slow while Chromium is not,
the likely causes are Firefox's `backdrop-filter` implementation (we just removed
the one that was always on screen), the canvas path, or a driver issue.

To test the backdrop theory cheaply, in Firefox:

- `about:config` → `layout.css.backdrop-filter.enabled` = **false**
- Reload and scroll again

If it becomes smooth, `backdrop-filter` is the cause and we should reduce the
remaining ones rather than hunt further.

## 3. Get the actual numbers from Firefox itself

If steps 1 and 2 do not settle it, this is the step that produces a diagnosis
rather than a guess:

- `about:performance`, record 10 seconds of scrolling, and **export** the profile
  (the download button). The file is a JSON profile that opens in
  [Speedscope](https://www.speedscope.app/) - drag it in
- The frames with the widest purple bars are where the time went

That file can be attached to an issue or sent to me, and it turns "it's slow" into
a specific function.

## 4. What I would like, in order of usefulness

1. **Which Firefox build**, and whether it is Firefox, LibreWolf, or another
   hardened fork. LibreWolf disables WebGL, which we already handle, but it also
   ships extensions that change behaviour.
2. **Whether it is Earth only, or every page.** Earth is the only WebGL view, so
   "Earth only" points somewhere quite different from "everywhere".
3. **The exported `about:performance` profile** from a 10-second scroll.
4. Whether it is a **laptop** - a machine with integrated graphics and a
   thermally limited CPU would be the environment where our canvas path hurts.

## What is already ruled out

- No frame-rate bug on GPU-accelerated hardware: 144fps measured, 0 dropped frames
- Not the service worker serving stale assets: navigations are network-first and
  assets are content-hashed
- Not unbounded reconnect: the backoff is capped at 60 seconds
- Not a leak from a pending timer or an unterminated promise - the ambient
  backdrops pause on `visibilitychange` and the prayer-clock interval is `unref`'d