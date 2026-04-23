import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import check from '../checks/no-typography-in-styles.check.js'
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

describe('no-typography-in-styles check', () => {
    it('produces no violations when typography comes from getTypography', async () => {
        const violations = await check.run(loadFixture('typography.good.tsx'))
        expect(violations).toEqual([])
    })

    it('flags direct typography properties inside makeStyles regardless of value', async () => {
        const violations = await check.run(loadFixture('typography.bad.tsx'))
        expect(violations).toHaveLength(2)
        expect(violations.map(v => v.ruleId)).toEqual([
            'no-typography-in-styles',
            'no-typography-in-styles',
        ])
        expect(violations.map(v => ({ line: v.line, column: v.column }))).toEqual([
            { line: 5, column: 9 },
            { line: 6, column: 9 },
        ])
        expect(violations[0].message).toContain('"fontSize"')
        expect(violations[1].message).toContain('"fontWeight"')
    })

    it('does not crash on files without makeStyles', async () => {
        const filePath = '/virtual/plain.ts'
        const sf = ts.createSourceFile(
            filePath,
            'export const x = { fontSize: 10 }\n',
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        const sources: SourceMap = new Map([[filePath, sf]])
        const violations = await check.run(sources)
        expect(violations).toEqual([])
    })
})
