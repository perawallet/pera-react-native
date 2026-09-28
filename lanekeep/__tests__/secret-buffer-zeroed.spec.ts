/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/secret-buffer-zeroed.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/secret-zeroing/packages/kms/src'

const reported = async (file: string) =>
    locations(await runRule(RULE, `${FIXTURES}/${file}`))

describe('pera/secret-buffer-zeroed', () => {
    it('reports at the exit a secret buffer leaves by without being zeroed', async () => {
        expect(await reported('derive.ts')).toEqual([
            'derive.ts:3',
            'derive.ts:8',
            'derive.ts:35',
            'derive.ts:50',
        ])
    })

    it('tracks every producer of key material, including unbound results', async () => {
        expect(await reported('producers.ts')).toEqual([
            'producers.ts:3',
            'producers.ts:8',
            'producers.ts:12',
            'producers.ts:26',
        ])
    })

    it('counts a wipe only when it sits in a finally block', async () => {
        expect(await reported('finally.ts')).toEqual([
            'finally.ts:5',
            'finally.ts:11',
        ])
    })

    it('accepts returning the buffer and bailing out on a null guard', async () => {
        expect(await reported('transfers.ts')).toEqual([
            'transfers.ts:34',
            'transfers.ts:39',
            'transfers.ts:45',
        ])
    })

    it('counts a wipe of a secret field of the result or of an alias, and nothing else', async () => {
        expect(await reported('members.ts')).toEqual([
            'members.ts:30',
            'members.ts:39',
            'members.ts:48',
        ])
    })

    it('reports destructuring that leaves every secret field of the result unbound', async () => {
        expect(await reported('destructure.ts')).toEqual(['destructure.ts:2'])
    })
})
