import { relative } from 'node:path'
import type { Violation } from '../types.js'

export interface RunSummary {
    violations: Violation[]
    timingsMs: Record<string, number>
    totalMs: number
}

const ANSI = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
} as const

function colorsDisabled(): boolean {
    const value = process.env.NO_COLOR
    return value !== undefined && value !== ''
}

function paint(code: string, text: string): string {
    if (colorsDisabled()) return text
    return `${code}${text}${ANSI.reset}`
}

function groupByRule(violations: Violation[]): Map<string, Violation[]> {
    const groups = new Map<string, Violation[]>()
    for (const v of violations) {
        const bucket = groups.get(v.ruleId)
        if (bucket) {
            bucket.push(v)
        } else {
            groups.set(v.ruleId, [v])
        }
    }
    return groups
}

function formatTimings(timingsMs: Record<string, number>): string {
    const entries = Object.entries(timingsMs).map(
        ([id, ms]) => `${id}: ${ms}ms`,
    )
    return `{${entries.join(', ')}}`
}

export function formatHuman(summary: RunSummary, repoRoot: string): string {
    if (summary.violations.length === 0) {
        const line = `✔ guardrails: no violations (total ${summary.totalMs}ms)`
        return `${paint(ANSI.green, line)}\n`
    }

    const groups = groupByRule(summary.violations)
    const parts: string[] = []

    for (const [ruleId, group] of groups) {
        parts.push(
            `\n${paint(ANSI.bold, `${ruleId}: ${group.length} violation(s)`)}\n`,
        )
        for (const v of group) {
            const rel = relative(repoRoot, v.file)
            const loc = paint(ANSI.red, `${rel}:${v.line}:${v.column}`)
            parts.push(`${loc} [${v.ruleId}] ${v.message}\n`)
            parts.push(`  → Fix: ${v.remediation}\n`)
        }
    }

    const footer = paint(
        ANSI.red,
        `✖ ${summary.violations.length} guardrail violation(s) across ${groups.size} rule(s) (total ${summary.totalMs}ms)`,
    )
    parts.push(`${footer}\n`)
    parts.push(`Per-check timings: ${formatTimings(summary.timingsMs)}\n`)

    return parts.join('')
}

export function formatJson(summary: RunSummary, repoRoot: string): string {
    const payload = {
        ok: summary.violations.length === 0,
        total: summary.violations.length,
        durationMs: summary.totalMs,
        timings: summary.timingsMs,
        violations: summary.violations.map((v) => ({
            ...v,
            file: relative(repoRoot, v.file),
        })),
    }
    return `${JSON.stringify(payload, null, 2)}\n`
}
