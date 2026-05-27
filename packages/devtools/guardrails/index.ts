#!/usr/bin/env tsx
import { cpus } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { isMainThread, Worker } from 'node:worker_threads'
import { parseArgs } from './utils/args.js'
import { discoverFilePaths, findRepoRoot } from './utils/discovery.js'
import { formatHuman, formatJson, type RunSummary } from './utils/output.js'
import {
    loadChecks,
    runChecksAgainstPaths,
    type ChunkResult,
} from './execute.js'
export type { RunSummary } from './utils/output.js'
import {
    IN_PROCESS_THRESHOLD,
    pickWorkerCount,
    readWorkerCountOverride,
    shouldForceWorkers,
} from './constants.js'
import type { Check, Violation } from './types.js'

function compareViolations(a: Violation, b: Violation): number {
    if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1
    if (a.file !== b.file) return a.file < b.file ? -1 : 1
    if (a.line !== b.line) return a.line - b.line
    return a.column - b.column
}

function roundTimings(timings: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [id, ms] of Object.entries(timings)) out[id] = Math.round(ms)
    return out
}

interface AggregateResult extends ChunkResult {
    workers: number
}

function roundRobin<T>(items: T[], n: number): T[][] {
    const chunks: T[][] = Array.from({ length: n }, () => [])
    items.forEach((item, i) => chunks[i % n].push(item))
    return chunks
}

function runOneWorker(
    paths: string[],
    workerUrl: URL,
    checksDirHref: string,
): Promise<ChunkResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(fileURLToPath(workerUrl), {
            workerData: { checksDirHref },
        })
        const terminate = (): void => {
            worker.terminate().catch(() => {})
        }
        worker.on(
            'message',
            (msg: {
                kind: 'ok' | 'err'
                result?: ChunkResult
                message?: string
            }) => {
                if (msg.kind === 'ok' && msg.result) {
                    resolve(msg.result)
                    terminate()
                } else {
                    reject(new Error(msg.message ?? 'unknown worker error'))
                    terminate()
                }
            },
        )
        worker.on('error', err => {
            reject(err)
            terminate()
        })
        worker.on('exit', code => {
            if (code !== 0 && code !== null) {
                reject(new Error(`worker exited with code ${code}`))
            }
        })
        worker.postMessage({ paths })
    })
}

function mergeChunkResult(target: AggregateResult, result: ChunkResult): void {
    target.violations.push(...result.violations)
    for (const [id, ms] of Object.entries(result.timings)) {
        target.timings[id] = (target.timings[id] ?? 0) + ms
    }
    target.parseMs += result.parseMs
    target.walkMs += result.walkMs
}

async function dispatch(
    paths: string[],
    checks: Check[],
    checksDirUrl: URL,
): Promise<AggregateResult> {
    const override = readWorkerCountOverride(process.env.GUARDRAILS_WORKERS)
    const force = shouldForceWorkers(process.env.GUARDRAILS_FORCE_WORKERS)
    // Cross-file checks (those with a `finalize` hook) need to see every
    // SourceFile in one context. Sharding their paths across workers would
    // produce false positives, so they always run in-process on the main
    // thread. Per-file checks remain shardable via the worker pool.
    const perFileChecks = checks.filter(c => c.finalize === undefined)
    const crossFileChecks = checks.filter(c => c.finalize !== undefined)
    const useWorkers =
        perFileChecks.length > 0 &&
        (force || paths.length >= IN_PROCESS_THRESHOLD)

    const merged: AggregateResult = {
        violations: [],
        timings: {},
        parseMs: 0,
        walkMs: 0,
        workers: 0,
    }

    if (useWorkers) {
        const count =
            override ??
            pickWorkerCount({ files: paths.length, cpus: cpus().length })
        const chunks = roundRobin(paths, count)
        const workerUrl = new URL('./worker-entry.mjs', import.meta.url)
        const results = await Promise.all(
            chunks.map(chunk =>
                runOneWorker(chunk, workerUrl, checksDirUrl.href),
            ),
        )
        merged.workers = count
        for (const r of results) mergeChunkResult(merged, r)
    } else if (perFileChecks.length > 0) {
        const result = await runChecksAgainstPaths(paths, perFileChecks)
        mergeChunkResult(merged, result)
    }

    if (crossFileChecks.length > 0) {
        const result = await runChecksAgainstPaths(paths, crossFileChecks)
        mergeChunkResult(merged, result)
    }

    return merged
}

export interface RunGuardrailsOptions {
    repoRoot: string
    args: string[]
    checksDirUrl?: URL
}

export interface RunGuardrailsResult {
    output: string
    exitCode: 0 | 1
    summary: RunSummary
}

export async function runGuardrails(
    opts: RunGuardrailsOptions,
): Promise<RunGuardrailsResult> {
    const args = parseArgs(opts.args)
    const started = performance.now()

    const checksDirUrl =
        opts.checksDirUrl ?? new URL('./checks/', import.meta.url)
    const paths = await discoverFilePaths(opts.repoRoot)
    const checks = await loadChecks(checksDirUrl)

    const { violations, timings, parseMs, walkMs, workers } = await dispatch(
        paths,
        checks,
        checksDirUrl,
    )
    const sorted = [...violations].sort(compareViolations)

    const summary: RunSummary = {
        violations: sorted,
        timingsMs: roundTimings(timings),
        totalMs: Math.round(performance.now() - started),
        warnOnly: args.warnOnly,
        parseMs: Math.round(parseMs),
        walkMs: Math.round(walkMs),
        workers,
    }

    const output = args.json
        ? formatJson(summary, opts.repoRoot)
        : formatHuman(summary, opts.repoRoot)
    const exitCode: 0 | 1 = sorted.length === 0 || args.warnOnly ? 0 : 1
    return { output, exitCode, summary }
}

async function main(): Promise<void> {
    const repoRoot = findRepoRoot(import.meta.url)
    const { output, exitCode } = await runGuardrails({
        repoRoot,
        args: process.argv.slice(2),
    })
    await writeAndExit(output, exitCode)
}

function writeAndExit(output: string, code: number): Promise<never> {
    return new Promise(() => {
        const flushed = process.stdout.write(output, () => {
            process.exit(code)
        })
        if (!flushed) {
            process.stdout.once('drain', () => {
                process.exit(code)
            })
        }
    })
}

const isEntryPoint =
    isMainThread &&
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) {
    main().catch((err: unknown) => {
        const message =
            err instanceof Error ? (err.stack ?? err.message) : String(err)
        process.stderr.write(`${message}\n`)
        process.exit(2)
    })
}
