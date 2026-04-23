#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { isMainThread } from 'node:worker_threads'
import { parseArgs } from './utils/args.js'
import { discoverFilePaths, findRepoRoot } from './utils/discovery.js'
import { formatHuman, formatJson, type RunSummary } from './utils/output.js'
import { runChecksAgainstPaths } from './execute.js'
import type { Check, Violation } from './types.js'

function isCheck(value: unknown): value is Check {
    if (value === null || typeof value !== 'object') return false
    const candidate = value as { id?: unknown; visitors?: unknown }
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.visitors === 'object' &&
        candidate.visitors !== null
    )
}

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

export async function loadChecks(checksDirUrl: URL): Promise<Check[]> {
    const dirPath = fileURLToPath(checksDirUrl)
    if (!existsSync(dirPath)) return []

    const entries = await readdir(dirPath)
    const checkFiles = entries.filter(name => name.endsWith('.check.ts'))
    if (checkFiles.length === 0) return []

    const modules = await Promise.all(
        checkFiles.map(async file => {
            const href = new URL(file, checksDirUrl).href
            const mod = (await import(href)) as { default?: unknown }
            if (!isCheck(mod.default)) {
                throw new Error(
                    `guardrails: check file "${file}" must have a default export implementing the Check interface (id, visitors)`,
                )
            }
            return mod.default
        }),
    )
    return modules
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const started = performance.now()

    const repoRoot = findRepoRoot(import.meta.url)
    const paths = await discoverFilePaths(repoRoot)
    const checks = await loadChecks(new URL('./checks/', import.meta.url))

    const { violations, timings, parseMs, walkMs } =
        await runChecksAgainstPaths(paths, checks)
    const sorted = [...violations].sort(compareViolations)

    const summary: RunSummary = {
        violations: sorted,
        timingsMs: roundTimings(timings),
        totalMs: Math.round(performance.now() - started),
        warnOnly: args.warnOnly,
        parseMs: Math.round(parseMs),
        walkMs: Math.round(walkMs),
        workers: 0,
    }

    const output = args.json
        ? formatJson(summary, repoRoot)
        : formatHuman(summary, repoRoot)
    const exitCode = sorted.length === 0 || args.warnOnly ? 0 : 1
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
