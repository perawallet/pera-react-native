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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@perawallet/wallet-core-chain-contract/testing'
import {
    addressFamilyOf,
    findContactByAddress,
    isSameFamilyAddress,
    isValidFamilyAddress,
} from '../addressFamily'

const chains = vi.hoisted(() => ({
    list: [] as { id: string; family: string }[],
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: { list: () => chains.list } }),
}))

const ALGORAND_ADDRESS = `fx${'a'.repeat(40)}`
const EVM_ADDRESS = `0x${'b'.repeat(40)}`
const isEvm = (address: string) => /^0x[0-9a-f]{40}$/i.test(address)

beforeEach(() => {
    chains.list = [
        { id: 'algorand', family: 'algorand' },
        { id: 'ethereum', family: 'evm' },
        { id: 'base', family: 'evm' },
    ]
    addressCodecs.register({ ...fixtureCodec, chainId: 'algorand' as never })
    for (const chainId of ['ethereum', 'base']) {
        addressCodecs.register({
            ...fixtureCodec,
            chainId: chainId as never,
            isValid: isEvm,
            normalize: (address: string) => address.toUpperCase(),
            areEqual: (a: string, b: string) =>
                a.toLowerCase() === b.toLowerCase(),
        })
    }
})

afterEach(() => {
    addressCodecs.reset()
})

describe('addressFamilyOf', () => {
    test('names the family whose codec accepts the address', () => {
        expect(addressFamilyOf(ALGORAND_ADDRESS)).toEqual({
            family: 'algorand',
            address: ALGORAND_ADDRESS,
        })
    })

    test("names an EVM address's family once, in its canonical form", () => {
        expect(addressFamilyOf(EVM_ADDRESS)).toEqual({
            family: 'evm',
            address: EVM_ADDRESS.toUpperCase(),
        })
    })

    test('is unset when no codec accepts the address', () => {
        expect(addressFamilyOf('not-an-address')).toBeUndefined()
    })

    test('skips a family with no registered chain', () => {
        chains.list = [{ id: 'algorand', family: 'algorand' }]

        expect(addressFamilyOf(EVM_ADDRESS)).toBeUndefined()
    })
})

describe('isValidFamilyAddress', () => {
    test("follows the family's codec", () => {
        expect(isValidFamilyAddress('evm', EVM_ADDRESS)).toBe(true)
        expect(isValidFamilyAddress('evm', ALGORAND_ADDRESS)).toBe(false)
    })

    test('accepts any address for a family this build does not register', () => {
        chains.list = [{ id: 'algorand', family: 'algorand' }]

        expect(isValidFamilyAddress('evm', 'anything')).toBe(true)
    })
})

describe('isSameFamilyAddress', () => {
    test("compares by the family's codec, so checksum case does not matter", () => {
        expect(
            isSameFamilyAddress('evm', EVM_ADDRESS, EVM_ADDRESS.toUpperCase()),
        ).toBe(true)
        expect(
            isSameFamilyAddress('evm', EVM_ADDRESS, `0x${'c'.repeat(40)}`),
        ).toBe(false)
    })
})

describe('findContactByAddress', () => {
    const ALICE = { addresses: { algorand: ALGORAND_ADDRESS } }
    const BOB = { addresses: { evm: EVM_ADDRESS } }

    test("finds the contact holding the address in that family, by the family's codec", () => {
        expect(
            findContactByAddress([ALICE, BOB], EVM_ADDRESS.toUpperCase(), 'evm'),
        ).toBe(BOB)
    })

    test('ignores a contact holding the address only in another family', () => {
        expect(
            findContactByAddress([BOB], EVM_ADDRESS, 'algorand'),
        ).toBeUndefined()
    })

    test('searches every family when none is given', () => {
        expect(findContactByAddress([ALICE, BOB], EVM_ADDRESS)).toBe(BOB)
        expect(findContactByAddress([ALICE, BOB], ALGORAND_ADDRESS)).toBe(ALICE)
    })

    test('does not match a mere part of an address', () => {
        expect(
            findContactByAddress([BOB], EVM_ADDRESS.slice(0, 10)),
        ).toBeUndefined()
    })
})
