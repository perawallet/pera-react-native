/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Lightweight tracer for ad-hoc latency profiling (cold start, a slow screen
 * transition, an expensive effect, etc.). Records named marks against a
 * monotonic clock, logs each mark immediately through the shared `logger` (so
 * a crash mid-flow still leaves a partial timeline), and can print a
 * consolidated, ordered table on demand.
 *
 * It is **passive on import** — pulling it in via the barrel costs nothing and
 * emits no output. It only does work once you call `mark`/`track`/`dump`.
 *
 * Every line is prefixed `⏱️ [TRACE]` so it is greppable from Metro or logcat:
 *
 *   adb logcat | grep TRACE              # Android
 *   npx react-native log-ios | grep TRACE
 *
 * Usage:
 *
 *   import { tracer } from '@perawallet/wallet-core-shared'
 *
 *   tracer.reset()                       // re-anchor t0 for an ad-hoc session
 *   tracer.mark('step-a')
 *   await tracer.track('fetch', () => fetchThing())
 *   tracer.mark('step-b', { count })
 *   tracer.dump()                        // print the ordered table
 *
 * Disable globally with `globalThis.__PERA_TRACER__ = false`.
 *
 * Note: `mark` is one-shot per label (first call wins) so it is safe to call
 * from a render body. Call `reset()` to start a fresh session and re-allow a
 * label.
 */

import { logger } from './logging'

const ENABLED =
    (globalThis as { __PERA_TRACER__?: boolean }).__PERA_TRACER__ !== false

const LOG_PREFIX = '⏱️ [TRACE]'

const DEFAULT_QUERY_CACHE_WINDOW_MS = 30_000

type Clock = () => number

const monotonic: Clock = (() => {
    const perf = (globalThis as { performance?: { now?: () => number } })
        .performance
    if (perf && typeof perf.now === 'function') {
        return () => perf.now!()
    }
    return () => Date.now()
})()

// t0 is anchored when this module is first evaluated. For cold-start profiling
// that is ≈ first JS executed (import the tracer at the top of the JS entry).
// For ad-hoc profiling of a later operation, call `reset()` first to re-anchor.
let T0 = monotonic()
let EPOCH0 = Date.now()

type Mark = {
    label: string
    /** ms since t0 */
    at: number
    /** ms since the previous recorded mark */
    delta: number
    /** wall-clock epoch (ms) for cross-referencing native logs */
    epoch: number
    meta?: Record<string, unknown>
}

let marks: Mark[] = []
let seen = new Set<string>()

const fmt = (ms: number): string => `${ms.toFixed(1)}ms`

const logLine = (m: Mark): void => {
    const metaStr = m.meta ? ` ${JSON.stringify(m.meta)}` : ''
    logger.info(
        `${LOG_PREFIX} +${fmt(m.delta).padStart(9)}  @${fmt(m.at).padStart(
            9,
        )}  ${m.label}${metaStr}`,
    )
}

/** Re-anchor t0 and clear recorded marks — start a fresh profiling session. */
const reset = (): void => {
    T0 = monotonic()
    EPOCH0 = Date.now()
    marks = []
    seen = new Set<string>()
}

/**
 * Record a one-shot mark. Duplicate labels are ignored (first wins) so this is
 * safe to call from a render body or an effect that may run more than once.
 * Call `reset()` to start a fresh session.
 */
const mark = (label: string, meta?: Record<string, unknown>): void => {
    if (!ENABLED) return
    if (seen.has(label)) return
    seen.add(label)
    const at = monotonic() - T0
    const prev = marks.length ? marks[marks.length - 1].at : 0
    const m: Mark = { label, at, delta: at - prev, epoch: Date.now(), meta }
    marks.push(m)
    logLine(m)
}

/**
 * Time an async step. Marks `${label}` on resolution with the measured
 * duration in meta, and `${label}:error` on rejection. The error is re-thrown
 * so control flow is unchanged.
 */
const track = async <T>(
    label: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
): Promise<T> => {
    if (!ENABLED) return fn()
    const start = monotonic()
    try {
        const result = await fn()
        mark(label, { ...meta, durationMs: +(monotonic() - start).toFixed(1) })
        return result
    } catch (error) {
        mark(`${label}:error`, {
            ...meta,
            durationMs: +(monotonic() - start).toFixed(1),
            message: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

/** Print the consolidated, ordered timeline table. */
const dump = (reason = 'manual'): void => {
    if (!ENABLED) return
    const lines: string[] = []
    lines.push(
        `${LOG_PREFIX} ===== TIMELINE (${reason}) — t0 epoch ${new Date(
            EPOCH0,
        ).toISOString()} =====`,
    )
    let biggestLabel = ''
    let biggestDelta = 0
    for (const m of marks) {
        if (m.delta > biggestDelta) {
            biggestDelta = m.delta
            biggestLabel = m.label
        }
        const metaStr = m.meta ? ` ${JSON.stringify(m.meta)}` : ''
        lines.push(
            `${LOG_PREFIX}   ${fmt(m.at).padStart(9)}  (+${fmt(
                m.delta,
            ).padStart(8)})  ${m.label}${metaStr}`,
        )
    }
    const total = marks.length ? marks[marks.length - 1].at : 0
    lines.push(
        `${LOG_PREFIX} ----- total tracked: ${fmt(
            total,
        )} | biggest gap: ${biggestLabel} (+${fmt(biggestDelta)}) -----`,
    )
    logger.info(lines.join('\n'))
}

/** Print the timeline table once after `ms` (opt-in; nothing is scheduled by default). */
const scheduleDump = (ms: number, reason = `auto after ${ms}ms`): void => {
    if (!ENABLED) return
    setTimeout(() => dump(reason), ms)
}

/**
 * Subscribe to a TanStack `QueryCache` (passed untyped to avoid a dependency)
 * and log how long each query takes from first fetch to settle, for `windowMs`
 * after the call. Useful for profiling a data-heavy screen's query fan-out.
 * Auto-unsubscribes when the window closes.
 */
const instrumentQueryCache = (
    cache: {
        subscribe: (cb: (event: unknown) => void) => () => void
    },
    windowMs: number = DEFAULT_QUERY_CACHE_WINDOW_MS,
): void => {
    if (!ENABLED) return
    const inFlight = new Map<string, number>()
    const settledClasses = new Set<string>()

    const unsubscribe = cache.subscribe((event: unknown) => {
        const e = event as {
            query?: {
                queryHash?: string
                queryKey?: unknown[]
                state?: { fetchStatus?: string; status?: string }
            }
        }
        const query = e.query
        if (!query?.state || !query.queryHash) return

        const hash = query.queryHash
        const klass =
            (Array.isArray(query.queryKey) && String(query.queryKey[0])) ||
            'unknown'
        const fetchStatus = query.state.fetchStatus

        if (fetchStatus === 'fetching') {
            if (!inFlight.has(hash)) inFlight.set(hash, monotonic())
            return
        }

        const start = inFlight.get(hash)
        if (start === undefined) return
        inFlight.delete(hash)
        const durationMs = +(monotonic() - start).toFixed(1)
        const firstOfClass = !settledClasses.has(klass)
        settledClasses.add(klass)
        mark(
            `query:${klass}${firstOfClass ? ':first' : ''}:${hash.slice(0, 40)}`,
            {
                durationMs,
                status: query.state.status,
                firstOfClass,
            },
        )
    })

    setTimeout(() => {
        unsubscribe()
    }, windowMs)
}

export const tracer = {
    reset,
    mark,
    track,
    dump,
    scheduleDump,
    instrumentQueryCache,
    get enabled(): boolean {
        return ENABLED
    },
}
