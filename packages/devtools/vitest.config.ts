import { defineConfig } from 'vitest/config'
import { poolConfig } from '@perawallet/wallet-core-devtools/vitest/pool'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['guardrails/**/__tests__/**/*.{test,spec}.ts'],
        // `runner.spec.ts` shells out to `pnpm exec guardrails` via
        // `spawnSync`, which itself spawns `node:worker_threads` workers
        // for the parsing pipeline. On constrained CI runners that share
        // CPU with ~30 sibling vitest processes (one per turbo task), the
        // default 5s vitest timeout doesn't leave enough headroom for the
        // child process to start. The individual specs already pass
        // 30_000ms overrides; bumping the file/hook defaults to 60s gives
        // a uniform safety margin for the rest.
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
    // The shared `poolConfig` defaults to `pool: 'threads'`, which works
    // well for most packages. Guardrails is different: its runner spec
    // spawns its own worker_threads, and nesting those inside vitest's
    // thread pool produces three layers of CPU contention (vitest's
    // pool ↔ subprocess startup ↔ subprocess workers). Switching to
    // `forks` decouples vitest's worker mechanism from the test's, and
    // `singleFork: true` runs all guardrails specs sequentially in one
    // fork — there are only a handful of them, and the parallelism
    // savings are smaller than the cost of multiple forks racing to
    // spawn `pnpm` + worker threads at the same time on shared cores.
    ...poolConfig,
    pool: 'forks',
    poolOptions: {
        forks: {
            singleFork: true,
        },
    },
})
