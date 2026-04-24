import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import check from '../checks/no-primitive-rn-components.check.js'
import { sharedWalk } from '../execute.js'
import type { SourceMap, Violation } from '../types.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function buildSource(filePath: string, text: string): SourceMap {
    const kind = filePath.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    const sf = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        kind,
    )
    return new Map([[filePath, sf]])
}

function loadFixture(name: string): SourceMap {
    const filePath = join(FIXTURES, name)
    return buildSource(filePath, readFileSync(filePath, 'utf8'))
}

function run(sourceMap: SourceMap): Violation[] {
    const violations: Violation[] = []
    sharedWalk(sourceMap, [check], {}, violations)
    return violations
}

describe('no-primitive-rn-components check', () => {
    it('produces no violations when importing from @components/core', () => {
        const violations = run(loadFixture('primitives.good.tsx'))
        expect(violations).toEqual([])
    })

    it('flags banned RN imports and ignores unrelated names', () => {
        const violations = run(loadFixture('primitives.bad.tsx'))
        expect(violations).toHaveLength(2)
        const names = violations.map(v => v.message)
        expect(names[0]).toContain("instead of Text from 'react-native'")
        expect(names[1]).toContain("instead of View from 'react-native'")
        for (const v of violations) {
            expect(v.ruleId).toBe('no-primitive-rn-components')
            expect(v.line).toBe(1)
            expect(v.column).toBeGreaterThan(0)
        }
    })

    it('skips files under /apps/mobile/src/components/core/', () => {
        const text = readFileSync(
            join(FIXTURES, 'primitives.skipped.tsx'),
            'utf8',
        )
        const sources = buildSource(
            '/apps/mobile/src/components/core/PWSample/PWSample.tsx',
            text,
        )
        const violations = run(sources)
        expect(violations).toEqual([])
    })

    it('flags aliased imports based on the imported name, not the local alias', () => {
        const filePath = '/virtual/aliased.tsx'
        const sources = buildSource(
            filePath,
            "import { Text as MyText } from 'react-native'\nexport const C = () => <MyText />\n",
        )
        const violations = run(sources)
        expect(violations).toHaveLength(1)
        expect(violations[0].ruleId).toBe('no-primitive-rn-components')
        expect(violations[0].message).toContain('PWText')
    })

    it('does not crash on files without react-native imports', () => {
        const filePath = '/virtual/plain.ts'
        const sources = buildSource(filePath, 'export const x = 1\n')
        const violations = run(sources)
        expect(violations).toEqual([])
    })
})
