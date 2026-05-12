import os from 'node:os'

const cpuCount = Math.max(1, os.cpus().length)

const envOverride = Number(process.env.VITEST_MAX_THREADS)

// `turbo run test` spawns ~30 sibling vitest processes. If each used the
// full cpu_count we'd over-subscribe. Default to half the CPUs (min 2);
// override with VITEST_MAX_THREADS=N when running a single workspace.
export const maxThreads =
    Number.isFinite(envOverride) && envOverride > 0
        ? envOverride
        : Math.max(2, Math.floor(cpuCount / 2))

export const poolConfig = {
    pool: 'threads',
    poolOptions: {
        threads: {
            maxThreads,
            minThreads: 1,
        },
    },
}
