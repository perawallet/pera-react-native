import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import check from '../checks/no-error-toast-in-catch.check.js'
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

describe('no-error-toast-in-catch check', () => {
    it('produces no violations when error toasts are routed through showError', () => {
        const violations = run(loadFixture('error-toast-in-catch.good.ts'))
        expect(violations).toEqual([])
    })

    it('flags showToast({ type: "error" }) inside catch clauses and .catch handlers', () => {
        const violations = run(loadFixture('error-toast-in-catch.bad.ts'))
        expect(violations).toHaveLength(4)
        for (const v of violations) {
            expect(v.ruleId).toBe('no-error-toast-in-catch')
            expect(v.message).toContain('catch block')
            expect(v.line).toBeGreaterThan(0)
            expect(v.column).toBeGreaterThan(0)
        }
    })

    it('does not flag showToast with non-error type inside a catch', () => {
        const filePath = '/virtual/non-error-type.ts'
        const sources = buildSource(
            filePath,
            `declare const showToast: (opts: { type: string }) => void
declare const work: () => Promise<void>
export const fn = async () => {
    try { await work() } catch { showToast({ type: 'success' }) }
}
`,
        )
        expect(run(sources)).toEqual([])
    })

    it('does not flag showToast({ type: "error" }) outside any catch scope', () => {
        const filePath = '/virtual/outside.ts'
        const sources = buildSource(
            filePath,
            `declare const showToast: (opts: { type: string }) => void
export const fn = () => { showToast({ type: 'error' }) }
`,
        )
        expect(run(sources)).toEqual([])
    })

    it('skips files under apps/mobile/src/hooks/useErrorToast', () => {
        const filePath = '/apps/mobile/src/hooks/useErrorToast.ts'
        const sources = buildSource(
            filePath,
            `declare const showToast: (opts: { type: string }) => void
declare const work: () => Promise<void>
export const fn = async () => {
    try { await work() } catch { showToast({ type: 'error' }) }
}
`,
        )
        expect(run(sources)).toEqual([])
    })

    it('does not crash on files without showToast calls', () => {
        const filePath = '/virtual/plain.ts'
        const sources = buildSource(filePath, 'export const x = 1\n')
        expect(run(sources)).toEqual([])
    })
})
