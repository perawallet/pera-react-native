/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-secret-strings.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-strings/packages/kms/src'

const reported = async (file: string) =>
    locations(await runRule(RULE, `${FIXTURES}/${file}`))

/** The message the rule gives for the finding on one line of one fixture. */
const messageAt = async (file: string, line: number) => {
    const found = (await runRule(RULE, `${FIXTURES}/${file}`)).find(
        violation => violation.line === line,
    )

    return found?.message
}

const at = (file: string, lines: number[]) =>
    lines.map(line => `${file}:${line}`)

describe('pera/no-secret-strings', () => {
    it('follows a producer call and the parameter of each scoped helper into a string', async () => {
        expect(await reported('sources.bad.ts')).toEqual(
            at(
                'sources.bad.ts',
                [1, 3, 4, 6, 8, 10, 12, 14, 16, 18, 19, 21, 23],
            ),
        )
    })

    it('stays silent on a helper result, public material, a non-helper callback and a length', async () => {
        expect(await reported('sources.good.ts')).toEqual([])
    })

    it('reports each way key material becomes a string', async () => {
        expect(await reported('string-sinks.bad.ts')).toEqual(
            at(
                'string-sinks.bad.ts',
                [
                    3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59,
                    63, 67, 71, 75, 79, 83, 87, 91, 95, 99, 103, 107, 111, 115,
                    119, 123, 127, 130, 134, 137, 141, 145, 149, 153, 157, 160,
                ],
            ),
        )
    })

    it('stays silent on strings made from values that are not secret', async () => {
        expect(await reported('string-sinks.good.ts')).toEqual([])
    })

    it('reports key material held in state, a memo or a store', async () => {
        expect(await reported('holder-sinks.bad.ts')).toEqual(
            at(
                'holder-sinks.bad.ts',
                [3, 5, 9, 12, 15, 19, 23, 27, 32, 36, 40, 45, 50],
            ),
        )
    })

    it('accepts a zeroable copy in state, a non-state setter and a handed-off buffer', async () => {
        expect(await reported('holder-sinks.good.ts')).toEqual([])
    })

    it('reports a secret returned out of a scoped helper unmarked', async () => {
        expect(await reported('scoped-returns.bad.ts')).toEqual(
            at('scoped-returns.bad.ts', [1, 3, 5, 7, 9, 11, 14, 17, 18, 20]),
        )
    })

    it('accepts a handed-off buffer or a value derived from it leaving a scoped helper', async () => {
        expect(await reported('scoped-returns.good.ts')).toEqual([])
    })

    it('names the sink each finding is about', async () => {
        expect(await messageAt('holder-sinks.bad.ts', 50)).toBe(
            'key material is held in React state',
        )
        expect(await messageAt('string-sinks.bad.ts', 3)).toBe(
            'key material becomes a string here, which cannot be zeroed',
        )
        expect(await messageAt('holder-sinks.bad.ts', 3)).toBe(
            'key material is held in React state',
        )
        expect(await messageAt('holder-sinks.bad.ts', 12)).toBe(
            'key material is held in a useMemo result',
        )
        expect(await messageAt('holder-sinks.bad.ts', 19)).toBe(
            'key material is written to a store',
        )
        expect(await messageAt('scoped-returns.bad.ts', 1)).toBe(
            'key material leaves the scoped helper unmarked; pass it through handOffSecret to the owner that zeroes it',
        )
        expect(await messageAt('store-fields.bad.ts', 2)).toBe(
            '`password` in `FooState` holds a secret as a string, which cannot be zeroed; hold bytes or wordlist indices',
        )
    })

    it('reports a store field named for a secret and typed as a string', async () => {
        expect(await reported('store-fields.bad.ts')).toEqual(
            at('store-fields.bad.ts', [2, 4, 5, 6, 8, 10, 11, 12, 13]),
        )
    })

    it('accepts byte-typed, non-secret and non-store fields', async () => {
        expect(await reported('store-fields.good.ts')).toEqual([])
    })
})
