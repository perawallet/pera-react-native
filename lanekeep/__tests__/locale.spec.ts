/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import {
    keyLines,
    leafKeys,
    parseCached,
    pluralBase,
} from '../shared/locale.js'
import { resolveRelative } from '../shared/paths.js'

const RAW = [
    '{',
    '    "a": {',
    '        "b": "x \\"quoted\\"",',
    '        "c": ["y", "z"]',
    '    },',
    '    "d": null',
    '}',
    '',
].join('\n')

describe('lanekeep/shared/locale', () => {
    it('maps every key path to its 1-based line', () => {
        expect(Object.fromEntries(keyLines(RAW))).toEqual({
            a: 2,
            'a.b': 3,
            'a.c': 4,
            'a.c.0': 4,
            'a.c.1': 4,
            d: 6,
        })
    })

    it('fails fast instead of hanging on an unterminated string', () => {
        expect(() => keyLines('{"a": "x')).toThrow()
    })

    it('lists every leaf whatever its value type, not just strings', () => {
        expect([...leafKeys(RAW)].sort()).toEqual([
            'a.b',
            'a.c.0',
            'a.c.1',
            'd',
        ])
    })

    it('finds the base of a plural key', () => {
        expect(pluralBase('items_one')).toBe('items')
        expect(pluralBase('items_many')).toBe('items')
        expect(pluralBase('items')).toBeUndefined()
    })

    it('parses the same text once', () => {
        const raw = '{"k":"v"}'

        expect(parseCached(raw)).toBe(parseCached(`${raw}`))
        expect(parseCached('{"k":"w"}')).not.toBe(parseCached(raw))
    })

    it('resolves a specifier against the importing file', () => {
        expect(
            resolveRelative(
                'apps/mobile/src/i18n/locales.ts',
                './locales/en.json',
            ),
        ).toBe('apps/mobile/src/i18n/locales/en.json')
        expect(resolveRelative('a/b/c.ts', '../d.ts')).toBe('a/d.ts')
    })
})
