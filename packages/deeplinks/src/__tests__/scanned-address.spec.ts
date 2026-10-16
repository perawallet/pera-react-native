/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapters } from '../chain-adapter'
import { readScannedAddress } from '../scanned-address'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

const A = FIXTURE_CHAIN_ID
const B = 'fixturetwo' as ChainId
const C = 'fixturethree' as ChainId

const codecB: AddressCodec = {
    ...fixtureCodec,
    chainId: B,
    isValid: address => /^0x[0-9a-f]{40}$/.test(address),
}
// Accepts the same text as A: an address two chains share.
const codecC: AddressCodec = { ...fixtureCodec, chainId: C }

const ADDRESS_A = `fx${'a'.repeat(40)}`
const ADDRESS_B = `0x${'b'.repeat(40)}`

describe('readScannedAddress', () => {
    beforeEach(() => {
        addressCodecs.register(fixtureCodec)
        addressCodecs.register(codecB)
        deeplinkAdapters.register(
            fakeDeeplinkAdapter(A, ['fixturehex'], fixtureCodec),
        )
        deeplinkAdapters.register(
            fakeDeeplinkAdapter(B, ['fixturetwo'], codecB),
        )
    })

    afterEach(() => {
        addressCodecs.reset()
        deeplinkAdapters.reset()
    })

    it('finds a bare address the field chain accepts', () => {
        expect(readScannedAddress(` ${ADDRESS_A}\n`, [A])).toEqual({
            status: 'found',
            address: ADDRESS_A,
        })
    })

    it('finds the address a link on the field chain names', () => {
        expect(
            readScannedAddress(`fixturehex:${ADDRESS_A}?amount=1`, [A]),
        ).toEqual({ status: 'found', address: ADDRESS_A })
    })

    it('reports a bare address that belongs to another chain', () => {
        expect(readScannedAddress(ADDRESS_B, [A])).toEqual({
            status: 'other-chain',
            chainId: B,
        })
    })

    it('reports a link on a chain the field does not list', () => {
        expect(
            readScannedAddress(`fixturetwo:${ADDRESS_B}?amount=1`, [A]),
        ).toEqual({ status: 'other-chain', chainId: B })
    })

    it('finds an address for a field that lists the link chain among several', () => {
        expect(readScannedAddress(ADDRESS_B, [A, B])).toEqual({
            status: 'found',
            address: ADDRESS_B,
        })
    })

    it('is found for a field on either of two chains that share an address', () => {
        addressCodecs.register(codecC)

        expect(readScannedAddress(ADDRESS_A, [A])).toMatchObject({
            status: 'found',
        })
        expect(readScannedAddress(ADDRESS_A, [C])).toMatchObject({
            status: 'found',
        })
    })

    it('finds nothing in a link that names no address, or in text nothing claims', () => {
        expect(readScannedAddress('perawallet://app/home', [A])).toEqual({
            status: 'none',
        })
        expect(readScannedAddress('hello', [A])).toEqual({ status: 'none' })
    })
})
