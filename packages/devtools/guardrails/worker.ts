import { parentPort, workerData } from 'node:worker_threads'
import { loadChecks, runChecksAgainstPaths } from './execute.js'

if (!parentPort) throw new Error('guardrails worker: missing parentPort')

const port = parentPort
const checksDirUrl = new URL(
    (workerData as { checksDirHref: string }).checksDirHref,
)
// Workers only run per-file checks. Cross-file checks (with a `finalize`
// hook) need every SourceFile in one context and run on the main thread.
const checks = (await loadChecks(checksDirUrl)).filter(
    c => c.finalize === undefined,
)

interface WorkerMessage {
    paths: string[]
}

port.on('message', (msg: WorkerMessage) => {
    void (async () => {
        try {
            const result = await runChecksAgainstPaths(msg.paths, checks)
            port.postMessage({ kind: 'ok', result })
        } catch (err) {
            const message =
                err instanceof Error ? (err.stack ?? err.message) : String(err)
            port.postMessage({ kind: 'err', message })
        }
    })()
})
