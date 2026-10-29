/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { topLevelMapping, unquote } from '../shared/yaml.js'

describe('topLevelMapping', () => {
    it('maps scalar entries to unquoted values and 1-based lines', () => {
        const raw = [
            'overrides:',
            '  "@scope/a": ^1.0.0',
            "  '@scope/b': '>=2.0.0'",
            '  plain: 1.2.3 # why',
            '  esbuild@>=0.27.3 <0.28.1: ">=0.28.1"',
            "  'react-native-mmkv@<4': 4.0.0",
            '',
        ].join('\n')

        expect([...topLevelMapping(raw, 'overrides')]).toEqual([
            ['@scope/a', { value: '^1.0.0', line: 2 }],
            ['@scope/b', { value: '>=2.0.0', line: 3 }],
            ['plain', { value: '1.2.3', line: 4 }],
            ['esbuild@>=0.27.3 <0.28.1', { value: '>=0.28.1', line: 5 }],
            ['react-native-mmkv@<4', { value: '4.0.0', line: 6 }],
        ])
    })

    it('skips comments, blank lines and nested entries, and stops at the next column-0 key', () => {
        const raw = [
            'catalog:',
            '  # why',
            '  a: 1.0.0',
            '',
            "  '@x/y':",
            '    nested: 2.0.0',
            '  # between',
            '  b: 3.0.0',
            'other:',
            '  c: 4.0.0',
            '',
        ].join('\n')

        expect([...topLevelMapping(raw, 'catalog')]).toEqual([
            ['a', { value: '1.0.0', line: 3 }],
            ['b', { value: '3.0.0', line: 8 }],
        ])
    })

    it('returns an empty map for an absent key', () => {
        expect(
            topLevelMapping('catalog:\n  a: 1.0.0\n', 'overrides').size,
        ).toBe(0)
    })
})

describe('unquote', () => {
    it('strips single and double quotes', () => {
        expect([unquote("'a b'"), unquote('"c"')]).toEqual(['a b', 'c'])
    })

    it('drops a trailing comment from a plain value', () => {
        expect(unquote('1.2.3 # why')).toBe('1.2.3')
    })
})
