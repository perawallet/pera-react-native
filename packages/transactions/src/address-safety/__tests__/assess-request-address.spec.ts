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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { assessRequestAddress } from '../assess-request-address'
import type { KnownAddress } from '../models'
import { fakeCodec } from './fakeCodecs'

const ALGORAND: ChainId = 'algorand'
const EVM: ChainId = 'ethereum'

const OWN = 'OWN1AAAAAAAAAAAAOWN1'
const CONTACT = '0xc0n1bbbbbbbbbbbbc0n1'
const STRANGER = 'STR1CCCCCCCCCCCCSTR9'
const INVALID = 'not-an-address'

const KNOWN: readonly KnownAddress[] = [
    { address: OWN, source: 'own-account', name: 'Main' },
    { address: CONTACT, source: 'contact', name: 'Alice' },
]

const lookAlikeOf = (address: string) =>
    `${address.slice(0, 4)}ZZZZZZZZZZZZ${address.slice(-4)}`

const assess = (
    address: string,
    chainId: ChainId = ALGORAND,
    isListed = false,
) => assessRequestAddress({ address, chainId, knownAddresses: KNOWN, isListed })

describe('assessRequestAddress', () => {
    beforeEach(() => {
        addressCodecs.reset()
        addressCodecs.register({
            ...fakeCodec(ALGORAND, { isCaseBlind: false }),
            isValid: address => address !== INVALID,
        })
        addressCodecs.register(fakeCodec(EVM, { isCaseBlind: true }))
    })

    it('reports a listed address as listed, even when it also imitates a known one', () => {
        expect(assess(lookAlikeOf(OWN), ALGORAND, true)).toEqual({
            kind: 'listed',
        })
        expect(assess(STRANGER, EVM, true)).toEqual({ kind: 'listed' })
    })

    it('flags a look-alike of an own account on Algorand', () => {
        expect(assess(lookAlikeOf(OWN))).toEqual({
            kind: 'look-alike',
            knownAddress: KNOWN[0],
        })
    })

    it('flags a look-alike of a contact on EVM, whatever its letter case', () => {
        expect(assess(lookAlikeOf(CONTACT).toUpperCase(), EVM)).toEqual({
            kind: 'look-alike',
            knownAddress: KNOWN[1],
        })
    })

    it('passes a known address and a stranger quietly, never as a first send', () => {
        expect(assess(OWN)).toEqual({ kind: 'clear' })
        expect(assess(CONTACT.toUpperCase(), EVM)).toEqual({ kind: 'clear' })
        expect(assess(STRANGER)).toEqual({ kind: 'clear' })
    })

    it('passes an address its chain does not recognise', () => {
        expect(assess(INVALID)).toEqual({ kind: 'clear' })
    })
})
