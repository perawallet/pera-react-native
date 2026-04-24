import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import { buildKindIndex, sharedWalk } from '../execute.js'
import type { Check, Violation } from '../types.js'

function makeSource(text: string, name = '/virtual/a.ts'): ts.SourceFile {
    return ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )
}

describe('buildKindIndex', () => {
    it('groups visitors by SyntaxKind preserving check registration order', () => {
        const a: Check = {
            id: 'a',
            description: '',
            visitors: { [ts.SyntaxKind.ImportDeclaration]: vi.fn() },
        }
        const b: Check = {
            id: 'b',
            description: '',
            visitors: { [ts.SyntaxKind.ImportDeclaration]: vi.fn() },
        }
        const index = buildKindIndex([a, b])
        const handlers = index.get(ts.SyntaxKind.ImportDeclaration)
        expect(handlers).toBeDefined()
        expect(handlers).toHaveLength(2)
        expect(handlers![0].check.id).toBe('a')
        expect(handlers![1].check.id).toBe('b')
    })
})

describe('sharedWalk', () => {
    it('invokes visitors exactly once per matching node and injects ruleId + file', () => {
        const check: Check = {
            id: 'sample',
            description: '',
            visitors: {
                [ts.SyntaxKind.ImportDeclaration]: (_node, _sf, emit) => {
                    emit({
                        line: 1,
                        column: 1,
                        message: 'caught an import',
                        remediation: 'fix it',
                    })
                },
            },
        }
        const sf = makeSource(
            "import { x } from 'y'\nconst a = 1\n",
            '/virtual/main.ts',
        )
        const out: Violation[] = []
        const timings: Record<string, number> = {}
        sharedWalk(new Map([[sf.fileName, sf]]), [check], timings, out)
        expect(out).toHaveLength(1)
        expect(out[0].ruleId).toBe('sample')
        expect(out[0].file).toBe('/virtual/main.ts')
        expect(out[0].message).toBe('caught an import')
        expect(timings.sample).toBeGreaterThanOrEqual(0)
    })

    it('does not call visitors for node kinds no check registered', () => {
        const callSpy = vi.fn()
        const check: Check = {
            id: 'only-calls',
            description: '',
            visitors: { [ts.SyntaxKind.CallExpression]: callSpy },
        }
        const sf = makeSource('const x = 1\n')
        sharedWalk(new Map([[sf.fileName, sf]]), [check], {}, [])
        expect(callSpy).not.toHaveBeenCalled()
    })
})
