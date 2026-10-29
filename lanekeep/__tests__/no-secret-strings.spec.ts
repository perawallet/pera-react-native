/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-secret-strings.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-strings/packages/kms/src'

const reported = async (file: string) =>
    locations(await runRule(RULE, `${FIXTURES}/${file}`))

// A fixture case is one line, so a bad file reports once on each of its lines.
const everyLine = (file: string, count: number) =>
    Array.from({ length: count }, (_, i) => `${file}:${i + 1}`)

describe('pera/no-secret-strings', () => {
    it('follows a producer call and the parameter of each scoped helper into a string', async () => {
        expect(await reported('sources.bad.ts')).toEqual(
            everyLine('sources.bad.ts', 13),
        )
    })

    it('stays silent on a helper result, public material, a non-helper callback and a length', async () => {
        expect(await reported('sources.good.ts')).toEqual([])
    })

    it('reports each way key material becomes a string', async () => {
        expect(await reported('string-sinks.bad.ts')).toEqual(
            everyLine('string-sinks.bad.ts', 26),
        )
    })

    it('stays silent on strings made from values that are not secret', async () => {
        expect(await reported('string-sinks.good.ts')).toEqual([])
    })

    it('reports key material held in state, a memo or a store', async () => {
        expect(await reported('holder-sinks.bad.ts')).toEqual(
            everyLine('holder-sinks.bad.ts', 9),
        )
    })

    it('accepts a zeroable copy in state, a non-state setter and a handed-off buffer', async () => {
        expect(await reported('holder-sinks.good.ts')).toEqual([])
    })

    it('reports a secret returned out of a scoped helper unmarked', async () => {
        expect(await reported('scoped-returns.bad.ts')).toEqual(
            everyLine('scoped-returns.bad.ts', 9),
        )
    })

    it('accepts a handed-off buffer or a value derived from it leaving a scoped helper', async () => {
        expect(await reported('scoped-returns.good.ts')).toEqual([])
    })

    it('reports a store field named for a secret and typed as a string', async () => {
        expect(await reported('store-fields.bad.ts')).toEqual(
            everyLine('store-fields.bad.ts', 7),
        )
    })

    it('accepts byte-typed, non-secret and non-store fields', async () => {
        expect(await reported('store-fields.good.ts')).toEqual([])
    })
})
