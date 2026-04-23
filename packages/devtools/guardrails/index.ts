#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { parseArgs } from './utils/args.js'
import { discoverSources, findRepoRoot } from './utils/discovery.js'
import { formatHuman, formatJson, type RunSummary } from './utils/output.js'
import { filterSuppressed } from './utils/suppressions.js'
import type { Check, SourceMap, Violation } from './types.js'

interface RunChecksResult {
    violations: Violation[]
    timingsMs: Record<string, number>
}

function isCheck(value: unknown): value is Check {
    if (value === null || typeof value !== 'object') return false
    const candidate = value as { id?: unknown; visitors?: unknown }
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.visitors === 'object' &&
        candidate.visitors !== null
    )
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

export async function runChecks(
    checks: Check[],
    _sources: SourceMap,
): Promise<RunChecksResult> {
    const timingsMs: Record<string, number> = {}
    for (const check of checks) {
        timingsMs[check.id] = 0
    }
    return { violations: [], timingsMs }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const started = performance.now()

    const repoRoot = findRepoRoot(import.meta.url)
    const sources = await discoverSources(repoRoot)
    const checks = await loadChecks(new URL('./checks/', import.meta.url))
    const { violations, timingsMs } = await runChecks(checks, sources)
    const filtered = filterSuppressed(violations, sources)

    const summary: RunSummary = {
        violations: filtered,
        timingsMs,
        totalMs: Math.round(performance.now() - started),
        warnOnly: args.warnOnly,
    }

    const output = args.json
        ? formatJson(summary, repoRoot)
        : formatHuman(summary, repoRoot)
    const exitCode = filtered.length === 0 || args.warnOnly ? 0 : 1
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

main().catch((err: unknown) => {
    const message =
        err instanceof Error ? (err.stack ?? err.message) : String(err)
    process.stderr.write(`${message}\n`)
    process.exit(2)
})
