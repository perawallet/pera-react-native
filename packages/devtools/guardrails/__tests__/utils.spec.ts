import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { parseArgs } from '../utils/args.js'
import { formatHuman, type RunSummary } from '../utils/output.js'
import { filterSuppressed } from '../utils/suppressions.js'
import type { SourceMap, Violation } from '../types.js'
import {
    IN_PROCESS_THRESHOLD,
    FILES_PER_WORKER,
    MAX_WORKERS,
    pickWorkerCount,
    shouldForceWorkers,
    shouldProfile,
    readWorkerCountOverride,
} from '../constants.js'

describe('parseArgs', () => {
    it('returns defaults for no args', () => {
        expect(parseArgs([])).toEqual({ json: false, warnOnly: false })
    })

    it('recognises --json', () => {
        expect(parseArgs(['--json'])).toEqual({ json: true, warnOnly: false })
    })

    it('recognises --warn-only', () => {
        expect(parseArgs(['--warn-only'])).toEqual({
            json: false,
            warnOnly: true,
        })
    })

    it('recognises --json and --warn-only together', () => {
        expect(parseArgs(['--json', '--warn-only'])).toEqual({
            json: true,
            warnOnly: true,
        })
    })

    it('throws on unknown flag', () => {
        expect(() => parseArgs(['--nope'])).toThrow(
            /guardrails: unknown flag "--nope"/,
        )
    })
})

describe('formatHuman', () => {
    it('reports no violations for empty summary', () => {
        const summary: RunSummary = {
            violations: [],
            timingsMs: {},
            totalMs: 0,
            warnOnly: false,
            parseMs: 0,
            walkMs: 0,
            workers: 0,
        }
        const output = formatHuman(summary, '/repo')
        expect(output).toContain('no violations')
    })

    it('marks footer as warn-only and not blocking when warnOnly is true', () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
            process.stdout,
            'isTTY',
        )
        try {
            Object.defineProperty(process.stdout, 'isTTY', {
                value: false,
                configurable: true,
            })
            const summary: RunSummary = {
                violations: [
                    {
                        file: '/repo/src/a.ts',
                        line: 1,
                        column: 1,
                        ruleId: 'sample-rule',
                        message: 'nope',
                        remediation: 'fix it',
                    },
                ],
                timingsMs: { 'sample-rule': 5 },
                totalMs: 10,
                warnOnly: true,
                parseMs: 0,
                walkMs: 0,
                workers: 0,
            }
            const output = formatHuman(summary, '/repo')
            expect(output).toContain('warn-only, not blocking')
            expect(output).toContain('⚠')
            expect(output).not.toContain('✖')
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(
                    process.stdout,
                    'isTTY',
                    originalDescriptor,
                )
            } else {
                delete (process.stdout as { isTTY?: boolean }).isTTY
            }
        }
    })

    it('does not emit ANSI codes when stdout is not a TTY', () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
            process.stdout,
            'isTTY',
        )
        try {
            Object.defineProperty(process.stdout, 'isTTY', {
                value: false,
                configurable: true,
            })
            const summary: RunSummary = {
                violations: [
                    {
                        file: '/repo/src/a.ts',
                        line: 1,
                        column: 1,
                        ruleId: 'sample-rule',
                        message: 'nope',
                        remediation: 'fix it',
                    },
                ],
                timingsMs: { 'sample-rule': 5 },
                totalMs: 10,
                warnOnly: false,
                parseMs: 0,
                walkMs: 0,
                workers: 0,
            }
            const output = formatHuman(summary, '/repo')
            // eslint-disable-next-line no-control-regex
            expect(output).not.toMatch(/\x1b\[/)
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(
                    process.stdout,
                    'isTTY',
                    originalDescriptor,
                )
            } else {
                // Best-effort restore when no descriptor existed originally.
                delete (process.stdout as { isTTY?: boolean }).isTTY
            }
        }
    })
})

describe('filterSuppressed', () => {
    it('drops a violation when preceded by a guardrails-ignore-next-line comment', () => {
        const filePath = '/virtual/sample.ts'
        const text = [
            'const a = 1',
            '// guardrails-ignore-next-line sample-rule',
            'const b = 2',
        ].join('\n')
        const sf = ts.createSourceFile(
            filePath,
            text,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        const sources: SourceMap = new Map([[filePath, sf]])

        const violations: Violation[] = [
            {
                file: filePath,
                line: 3,
                column: 1,
                ruleId: 'sample-rule',
                message: 'nope',
                remediation: 'fix it',
            },
        ]

        const filtered = filterSuppressed(violations, sources)
        expect(filtered).toHaveLength(0)
    })

    it('does not suppress when the directive appears as a substring of another word', () => {
        const filePath = '/virtual/substring.ts'
        const text = [
            'const a = 1',
            '// see my-guardrails-ignore-next-line-policy sample-rule',
            'const b = 2',
        ].join('\n')
        const sf = ts.createSourceFile(
            filePath,
            text,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        const sources: SourceMap = new Map([[filePath, sf]])

        const violations: Violation[] = [
            {
                file: filePath,
                line: 3,
                column: 1,
                ruleId: 'sample-rule',
                message: 'nope',
                remediation: 'fix it',
            },
        ]

        const filtered = filterSuppressed(violations, sources)
        expect(filtered).toHaveLength(1)
    })

    it('keeps unrelated violations', () => {
        const filePath = '/virtual/sample2.ts'
        const text = ['const a = 1', 'const b = 2'].join('\n')
        const sf = ts.createSourceFile(
            filePath,
            text,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        const sources: SourceMap = new Map([[filePath, sf]])

        const violations: Violation[] = [
            {
                file: filePath,
                line: 2,
                column: 1,
                ruleId: 'sample-rule',
                message: 'nope',
                remediation: 'fix it',
            },
        ]

        const filtered = filterSuppressed(violations, sources)
        expect(filtered).toHaveLength(1)
    })
})

describe('guardrails constants', () => {
    it('exposes the documented defaults', () => {
        expect(IN_PROCESS_THRESHOLD).toBe(3000)
        expect(FILES_PER_WORKER).toBe(150)
        expect(MAX_WORKERS).toBe(4)
    })

    it('pickWorkerCount respects cpu count, file count, and the max cap', () => {
        expect(pickWorkerCount({ files: 0, cpus: 8 })).toBe(1)
        expect(pickWorkerCount({ files: 300, cpus: 2 })).toBe(1)
        expect(pickWorkerCount({ files: 300, cpus: 4 })).toBe(2)
        expect(pickWorkerCount({ files: 900, cpus: 8 })).toBe(4)
    })

    it('readWorkerCountOverride parses valid integers and rejects noise', () => {
        expect(readWorkerCountOverride('3')).toBe(3)
        expect(readWorkerCountOverride(undefined)).toBeNull()
        expect(readWorkerCountOverride('')).toBeNull()
        expect(readWorkerCountOverride('abc')).toBeNull()
        expect(readWorkerCountOverride('0')).toBeNull()
    })

    it('shouldForceWorkers / shouldProfile accept 1 and "true"', () => {
        expect(shouldForceWorkers('1')).toBe(true)
        expect(shouldForceWorkers('true')).toBe(true)
        expect(shouldForceWorkers('')).toBe(false)
        expect(shouldForceWorkers(undefined)).toBe(false)
        expect(shouldProfile('1')).toBe(true)
        expect(shouldProfile(undefined)).toBe(false)
    })
})
