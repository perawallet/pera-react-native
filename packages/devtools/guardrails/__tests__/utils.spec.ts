import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { parseArgs } from '../utils/args.js'
import { formatHuman, type RunSummary } from '../utils/output.js'
import { filterSuppressed } from '../utils/suppressions.js'
import type { SourceMap, Violation } from '../types.js'

describe('parseArgs', () => {
    it('returns { json: true } for --json', () => {
        expect(parseArgs(['--json'])).toEqual({ json: true })
    })

    it('returns { json: false } for no args', () => {
        expect(parseArgs([])).toEqual({ json: false })
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
        }
        const output = formatHuman(summary, '/repo')
        expect(output).toContain('no violations')
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
