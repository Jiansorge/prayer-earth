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