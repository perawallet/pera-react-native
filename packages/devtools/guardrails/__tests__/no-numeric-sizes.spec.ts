import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import check from '../checks/no-numeric-sizes.check.js'
import type { SourceMap } from '../types.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function loadFixture(name: string): SourceMap {
    const filePath = join(FIXTURES, name)
    const text = readFileSync(filePath, 'utf8')
    const kind = name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sf = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        kind,
    )
    return new Map([[filePath, sf]])
}

describe('no-numeric-sizes check', () => {
    it('produces no violations for theme-token-only styles', async () => {
        const violations = await check.run!(
            loadFixture('numeric-sizes.good.ts'),
        )
        expect(violations).toEqual([])
    })

    it('flags literal numeric spacing values, skipping 0 and theme tokens', async () => {
        const violations = await check.run!(loadFixture('numeric-sizes.bad.ts'))
        expect(violations.map(v => v.ruleId)).toEqual([
            'no-numeric-sizes',
            'no-numeric-sizes',
            'no-numeric-sizes',
        ])

        expect(violations).toHaveLength(3)

        const positions = violations.map(v => ({
            line: v.line,
            column: v.column,
            message: v.message,
        }))
        expect(positions).toEqual([
            {
                line: 4,
                column: 22,
                message: 'numeric value 12 for "padding" — use a theme token',
            },
            {
                line: 4,
                column: 38,
                message:
                    'numeric value -16 for "marginLeft" — use a theme token',
            },
            {
                line: 4,
                column: 57,
                message:
                    'numeric value 24 for "borderRadius" — use a theme token',
            },
        ])
    })

    it('does not crash on files without makeStyles', async () => {
        const filePath = '/virtual/plain.ts'
        const sf = ts.createSourceFile(
            filePath,
            'export const x = 1\n',
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        const sources: SourceMap = new Map([[filePath, sf]])
        const violations = await check.run!(sources)
        expect(violations).toEqual([])
    })
})
