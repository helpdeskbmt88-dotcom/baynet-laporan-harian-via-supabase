import { spawn } from 'node:child_process'

const launch = (args) => spawn(process.execPath, args, { stdio: 'inherit' })
const children = [
  launch(['--env-file-if-exists=.env', 'server/index.js']),
  launch(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1']),
]
let stopping = false
function finish(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exitCode = code
}
for (const child of children) child.on('exit', code => finish(code ?? 1))
process.on('SIGINT', () => finish(0))
process.on('SIGTERM', () => finish(0))
