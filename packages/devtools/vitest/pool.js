import os from 'node:os'

const cpuCount = Math.max(1, os.availableParallelism?.() ?? os.cpus().length)

// `turbo run test` spawns ~30 sibling vitest processes. If each used vitest's
// default of cpu_count - 1 workers we'd over-subscribe the machine, so default
// to half the CPUs (min 2). Spread this inside `test`: vitest ignores it at
// the top level of the config. Vitest itself reads VITEST_MAX_WORKERS=N over
// this, for a CI runner or a single workspace that wants a different cap.
export const maxWorkers = Math.max(2, Math.floor(cpuCount / 2))

export const poolConfig = {
    maxWorkers,
}
