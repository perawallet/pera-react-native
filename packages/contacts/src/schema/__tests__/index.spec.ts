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

import { afterEach, beforeEach, describe, test, expect } from 'vitest'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@perawallet/wallet-core-chain-contract/testing'
import type { ContactAddresses } from '../../models'
import { contactFromFormValues, contactSchema, contactToFormValues } from '..'

// The form's address rule is whatever the Algorand-chain codec accepts, so a
// stand-in codec under that chain id pins the delegation.
const VALID_ADDRESS = `fx${'a'.repeat(40)}`

const parseAddress = (address: string) =>
    contactSchema.safeParse({ name: 'Alice', address })

beforeEach(() => {
    addressCodecs.register({ ...fixtureCodec, chainId: LEGACY_CHAIN_ID })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('contactSchema address validation', () => {
    test("accepts an address the Algorand chain's codec accepts", () => {
        expect(parseAddress(VALID_ADDRESS).success).toBe(true)
    })

    test("rejects an address the Algorand chain's codec rejects", () => {
        expect(parseAddress(`${VALID_ADDRESS.slice(0, -1)}z`).success).toBe(
            false,
        )
        expect(parseAddress('').success).toBe(false)
    })
})

describe('contact form mapping', () => {
    test('contactToFormValues edits the Algorand entry', () => {
        expect(
            contactToFormValues({
                name: 'Alice',
                nfd: 'alice.algo',
                addresses: {
                    algorand: VALID_ADDRESS,
                    other: 'X',
                } as ContactAddresses,
            }),
        ).toEqual({ name: 'Alice', nfd: 'alice.algo', address: VALID_ADDRESS })
    })

    test('contactFromFormValues writes the address into the Algorand entry', () => {
        expect(
            contactFromFormValues({ name: 'Alice', address: VALID_ADDRESS }),
        ).toEqual({ name: 'Alice', addresses: { algorand: VALID_ADDRESS } })
    })

    test("contactFromFormValues keeps the existing contact's other-family addresses", () => {
        const existing = {
            name: 'Alice',
            image: 'file://old.png',
            addresses: { algorand: 'OLD', other: 'X' } as ContactAddresses,
        }

        expect(
            contactFromFormValues(
                { name: 'Alicia', address: VALID_ADDRESS },
                existing,
            ),
        ).toEqual({
            name: 'Alicia',
            addresses: {
                algorand: VALID_ADDRESS,
                other: 'X',
            } as ContactAddresses,
        })
    })
})
