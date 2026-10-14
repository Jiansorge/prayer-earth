// Killing a dev server started through npm, on Windows.
//
// Each browser test here starts Vite via `npm run dev` with shell:true, which
// means the thing proc.kill() targets is the cmd.exe wrapper. The node process
// running Vite is its child and survives, still holding the port. Nothing in a
// single run notices. Across a session it adds up: three orphaned servers
// listening on 5173/5174/5175 and over a hundred stray node processes, which is
// what made an unrelated check fail for no reason and the machine feel slow.
//
// taskkill /T takes the whole tree, which is the only thing that actually stops
// the port being released.
import { execFileSync } from 'node:child_process'

export function killTree(proc) {
  if (!proc || proc.exitCode !== null) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], {
        stdio: 'ignore',
        timeout: 10000
      })
      return
    }
  } catch {
    // Fall through to the portable kill below.
  }
  try {
    proc.kill()
  } catch {}
}

// Is anything still listening on this port? Used to report a leaked server
// instead of letting the next test fail on someone else's leftover.
export function portInUse(port) {
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'netstat' : 'ss',
      process.platform === 'win32' ? ['-ano'] : ['-ltn'],
      { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    return new RegExp(`[:.]${port}\\s`).test(out) || out.includes(`:${port}`)
  } catch {
    return false
  }
}

// How long the first navigation into a Vite dev server is allowed to take.
//
// Measured, not guessed: with an empty node_modules/.vite the first page load
// takes ~52s and the second takes under one. Vite answers index.html almost
// immediately and then spends the rest transforming the whole module graph -
// three.js alone is hundreds of source files. Pulling the entry modules first
// does not help, because it is every transitive import that costs the time.
//
// Every browser test here starts its own dev server on its own port, and the
// port is part of Vite's config hash, so each one pays that first cost again.
// Five tests were failing on Playwright's 30s default against a server that was
// working perfectly, and the message - "Timeout 30000ms exceeded" - reads as a
// hung page rather than a cold one.
export const COLD_NAVIGATION_TIMEOUT = 180000

// A wait that gates on a lazily-imported chunk can be the very first request for
// that chunk, which on a cold dev server is another full transform - the Earth
// view's first visit pulls in three.js, which is the single largest thing this
// app loads. Same reasoning as the navigation timeout, so waits that mean "this
// view has appeared" use it; waits that mean "the app behaved correctly" keep
// their own budgets, because there a long wait is a real failure.
export const COLD_READY_TIMEOUT = 120000

// A page whose first navigation is budgeted for a cold dev server. Takes a
// browser or a context, because the tests create both.
export async function coldSafePage(browserOrContext) {
  const page = await browserOrContext.newPage()
  page.setDefaultNavigationTimeout(COLD_NAVIGATION_TIMEOUT)
  return page
}