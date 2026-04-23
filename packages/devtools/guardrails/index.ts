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
    const candidate = value as { id?: unknown; run?: unknown }
    return (
        typeof candidate.id === 'string' && typeof candidate.run === 'function'
    )
}

function compareViolations(a: Violation, b: Violation): number {
    if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1
    if (a.file !== b.file) return a.file < b.file ? -1 : 1
    if (a.line !== b.line) return a.line - b.line
    return a.column - b.column
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
                    `guardrails: check file "${file}" must have a default export implementing the Check interface (id, run)`,
                )
            }
            return mod.default
        }),
    )
    return modules
}

export async function runChecks(
    checks: Check[],
    sources: SourceMap,
): Promise<RunChecksResult> {
    const timingsMs: Record<string, number> = {}
    const results = await Promise.all(
        checks.map(async check => {
            const started = performance.now()
            try {
                const violations = check.run ? await check.run(sources) : []
                timingsMs[check.id] = Math.round(performance.now() - started)
                return violations
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                throw new Error(`check "${check.id}" threw: ${msg}`)
            }
        }),
    )
    const violations = results.flat().sort(compareViolations)
    return { violations, timingsMs }
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
