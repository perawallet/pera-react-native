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
        expect(() => parseArgs(['--nope'])).toThrow(/unknown flag: --nope/)
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
