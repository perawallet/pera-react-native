import os from 'node:os'
import { fileURLToPath } from 'node:url'

const cpuCount = Math.max(1, os.availableParallelism?.() ?? os.cpus().length)

// `turbo run test` spawns ~30 sibling vitest processes. If each used vitest's
// default of cpu_count - 1 workers we'd over-subscribe the machine, so default
// to half the CPUs (min 2). Spread this inside `test`: vitest ignores it at
// the top level of the config. Vitest itself reads VITEST_MAX_WORKERS=N over
// this, for a CI runner or a single workspace that wants a different cap.
export const maxWorkers = Math.max(2, Math.floor(cpuCount / 2))

// vmThreads runs each spec file in a fresh VM context inside a long-lived
// worker instead of booting jsdom and the module graph in a new process per
// file, which was most of every suite's wall time. A spec that redefines
// `window.location`, reaches Node's module internals or needs `instanceof`
// across realms can't run there; its workspace routes it to a forks project.
export const poolConfig = {
    maxWorkers,
    pool: 'vmThreads',
    // Recycle a worker past this. Vitest's default, system memory over CPU
    // count, lets the workers of several turbo tasks outgrow one CI runner.
    vmMemoryLimit: '1.5GB',
}

// List first in `setupFiles`: restores the Node globals the VM context lacks.
export const vmGlobalsSetup = fileURLToPath(
    new URL('./vm-globals.js', import.meta.url),
)
