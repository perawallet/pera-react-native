/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { workspaceMembers, yamlMap } from '../shared/workspace.js'

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
