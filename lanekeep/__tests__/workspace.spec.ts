/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import {
    manifestNameOf,
    workspaceDirs,
    workspaceMemberOf,
    workspaceMembers,
    yamlMap,
} from '../shared/workspace.js'

describe('workspaceMemberOf', () => {
    it('finds the member directory and its root', () => {
        expect(
            workspaceMemberOf(
                'packages/passkeys/src/native/__tests__/x.spec.ts',
            ),
        ).toEqual({ dir: 'packages/passkeys', root: 'packages' })
        expect(workspaceMemberOf('apps/mobile/src/a.ts')?.root).toBe('apps')
    })

    it("resolves a scratch fixture's own member directory", () => {
        expect(
            workspaceMemberOf(
                'lanekeep/__tests__/scratch-ab/extensions/plug/src/a.ts',
            ),
        ).toEqual({
            dir: 'lanekeep/__tests__/scratch-ab/extensions/plug',
            root: 'extensions',
        })
    })

    it('returns undefined outside a member', () => {
        expect(workspaceMemberOf('lanekeep/rules/a.ts')).toBeUndefined()
        expect(workspaceMemberOf('packages/a.ts')).toBeUndefined()
    })
})

describe('manifestNameOf', () => {
    const reader = (files: Record<string, string>) => ({
        readFile: (path: string) => files[path],
    })

    it('returns the package name', () => {
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{"name":"@x/a"}' }),
                'packages/a',
            ),
        ).toBe('@x/a')
    })

    it('returns undefined for a missing file, invalid JSON or a non-string name', () => {
        expect(manifestNameOf(reader({}), 'packages/a')).toBeUndefined()
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{' }),
                'packages/a',
            ),
        ).toBeUndefined()
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{"name": 3}' }),
                'packages/a',
            ),
        ).toBeUndefined()
    })
})

describe('yamlMap', () => {
    it('reads quoted, single-quoted and unquoted keys, including a selector with spaces', () => {
        const raw = [
            'overrides:',
            '  "@scope/a": 1.0.0',
            "  '@scope/b': ^2.0.0",
            '  plain: 3.0.0',
            '  esbuild@>=0.27.3 <0.28.1: ">=0.28.1"',
            "  '@gorhom/portal>nanoid': 6.0.0",
            '  empty:',
        ].join('\n')

        expect(
            yamlMap(raw, 'overrides').map(e => [e.key, e.value, e.line]),
        ).toEqual([
            ['@scope/a', '1.0.0', 2],
            ['@scope/b', '^2.0.0', 3],
            ['plain', '3.0.0', 4],
            ['esbuild@>=0.27.3 <0.28.1', '>=0.28.1', 5],
            ['@gorhom/portal>nanoid', '6.0.0', 6],
            ['empty', '', 7],
        ])
    })

    it('strips an inline comment from a value', () => {
        const raw = 'catalog:\n  a: 1.0.0 # why\n  b: "2.0.0" # why\n'

        expect(yamlMap(raw, 'catalog').map(e => e.value)).toEqual([
            '1.0.0',
            '2.0.0',
        ])
    })

    it('attaches the comment run directly above an entry, with line numbers, and drops it at a blank line', () => {
        const raw = [
            'catalog:',
            '  # header',
            '',
            '  # first',
            '  # second',
            '  a: 1.0.0',
            '  b: 2.0.0',
            '  # detached',
            '',
            '  c: 3.0.0',
        ].join('\n')

        expect(yamlMap(raw, 'catalog').map(e => [e.key, e.comments])).toEqual([
            [
                'a',
                [
                    { text: 'first', line: 4 },
                    { text: 'second', line: 5 },
                ],
            ],
            ['b', []],
            ['c', []],
        ])
    })

    it('skips nested lines and ends at the next top-level key', () => {
        const raw = [
            'first:',
            '  a:',
            '    nested: 1',
            '  b: 2',
            '# between',
            'second:',
            '  c: 3',
        ].join('\n')

        expect(yamlMap(raw, 'first').map(e => e.key)).toEqual(['a', 'b'])
        expect(yamlMap(raw, 'second').map(e => e.key)).toEqual(['c'])
    })

    it('returns nothing for an absent key', () => {
        expect(yamlMap('a:\n  b: 1\n', 'missing')).toEqual([])
    })
})

describe('workspaceMembers', () => {
    const files: Record<string, string> = {
        'pnpm-workspace.yaml': [
            'packages:',
            '  - packages/*',
            '  - conformance',
            '',
            'catalog:',
            '  a: 1.0.0',
        ].join('\n'),
    }
    const ctx = {
        readFile: (path: string) => files[path],
        listDir: (path: string) =>
            path === 'packages' ? ['alpha/', 'beta/', 'notes.md'] : undefined,
    }

    it('expands a <dir>/* pattern through listDir and keeps a literal pattern', () => {
        expect(workspaceMembers(ctx, '')).toEqual([
            'packages/alpha',
            'packages/beta',
            'conformance',
        ])
    })

    it('returns nothing without a pnpm-workspace.yaml', () => {
        const empty = { ...ctx, readFile: () => undefined }

        expect(workspaceMembers(empty, '')).toEqual([])
    })
})

describe('workspaceDirs', () => {
    it("maps each member's package name to its directory and skips a member without one", () => {
        const files: Record<string, string> = {
            'repo/pnpm-workspace.yaml':
                'packages:\n  - packages/*\n  - conformance\n',
            'repo/packages/alpha/package.json': '{"name":"@x/alpha"}',
            'repo/packages/beta/package.json': '{',
            'repo/conformance/package.json': '{"name":"conformance"}',
        }
        const ctx = {
            readFile: (path: string) => files[path],
            listDir: (path: string) =>
                path === 'repo/packages' ? ['alpha/', 'beta/'] : undefined,
        }

        expect(workspaceDirs(ctx, 'repo')).toEqual(
            new Map([
                ['@x/alpha', 'packages/alpha'],
                ['conformance', 'conformance'],
            ]),
        )
    })
})
