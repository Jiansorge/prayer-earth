// One command to run the whole Prayer Earth app: starts the shared sync
// server and the Vite dev server, restarts either if it crashes, and cleans
// up on exit. Run: npm start

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function start(name, cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true
  })
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
  child.stderr.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
  child.on('exit', (code) => {
    if (!exiting) {
      console.log(`[${name}] exited (code ${code}), restarting in 1s…`)
      setTimeout(() => start(name, cmd, args, cwd), 1000)
    }
  })
  return child
}

let exiting = false
const killAll = () => {
  exiting = true
  for (const c of children) {
    try {
      c.kill()
    } catch {}
  }
  process.exit(0)
}
process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const children = [
  start('server', process.execPath, ['server/index.js'], root),
  start('vite', process.execPath, [viteBin, '--host', '--port', '5173'], root)
]

console.log('☮  Prayer Earth is coming up…')
console.log('   App:    http://localhost:5173')
console.log('   Sync:   ws://localhost:8787')
