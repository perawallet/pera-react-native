import { parentPort, workerData } from 'node:worker_threads'
import { loadChecks } from './index.js'
import { runChecksAgainstPaths } from './execute.js'

if (!parentPort) throw new Error('guardrails worker: missing parentPort')

const port = parentPort
const checksDirUrl = new URL(
    (workerData as { checksDirHref: string }).checksDirHref,
)
const checks = await loadChecks(checksDirUrl)

interface WorkerMessage {
    paths: string[]
}

port.on('message', async (msg: WorkerMessage) => {
    try {
        const result = await runChecksAgainstPaths(msg.paths, checks)
        port.postMessage({ kind: 'ok', result })
    } catch (err) {
        const message =
            err instanceof Error ? (err.stack ?? err.message) : String(err)
        port.postMessage({ kind: 'err', message })
    }
})
