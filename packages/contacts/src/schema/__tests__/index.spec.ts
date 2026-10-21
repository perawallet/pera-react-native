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

import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@perawallet/wallet-core-chain-contract/testing'
import { contactFromFormValues, contactSchema, contactToFormValues } from '..'

const chains = vi.hoisted(() => ({
    list: [] as { id: string; family: string }[],
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: { list: () => chains.list } }),
}))

// A stand-in codec per family pins the delegation: the rule for an address
// is whatever its family's codec accepts.
const ALGORAND_ADDRESS = `fx${'a'.repeat(40)}`
const EVM_ADDRESS = `0x${'b'.repeat(40)}`

const parseAddresses = (addresses: Record<string, string>) =>
    contactSchema.safeParse({ name: 'Alice', addresses })

beforeEach(() => {
    chains.list = [
        { id: 'algorand', family: 'algorand' },
        { id: 'ethereum', family: 'evm' },
    ]
    addressCodecs.register({ ...fixtureCodec, chainId: 'algorand' as never })
    addressCodecs.register({
        ...fixtureCodec,
        chainId: 'ethereum' as never,
        isValid: (address: string) => /^0x[0-9a-f]{40}$/.test(address),
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('contactSchema addresses', () => {
    test("accepts each address its family's codec accepts", () => {
        expect(
            parseAddresses({ algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS })
                .success,
        ).toBe(true)
    })

    test("rejects an address its family's codec rejects", () => {
        expect(
            parseAddresses({
                algorand: ALGORAND_ADDRESS,
                evm: `${EVM_ADDRESS.slice(0, -1)}z`,
            }).success,
        ).toBe(false)
    })

    test('needs at least one address', () => {
        expect(parseAddresses({}).success).toBe(false)
        expect(parseAddresses({ algorand: '' }).success).toBe(false)
    })

    test('accepts the address of a family this build does not register', () => {
        chains.list = [{ id: 'algorand', family: 'algorand' }]

        expect(parseAddresses({ evm: 'anything' }).success).toBe(true)
    })
})

describe('contact form mapping', () => {
    test('contactToFormValues edits every family the contact holds', () => {
        expect(
            contactToFormValues({
                id: 'id-1',
                name: 'Alice',
                nfd: 'alice.algo',
                addresses: { algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS },
                removedFamilies: [],
            }),
        ).toEqual({
            id: 'id-1',
            name: 'Alice',
            nfd: 'alice.algo',
            addresses: { algorand: ALGORAND_ADDRESS, evm: EVM_ADDRESS },
        })
    })

    test('contactFromFormValues keeps only the families the form holds an address for', () => {
        expect(
            contactFromFormValues({
                name: 'Alice',
                addresses: { algorand: '', evm: EVM_ADDRESS },
            }),
        ).toEqual({ name: 'Alice', addresses: { evm: EVM_ADDRESS } })
    })
})
