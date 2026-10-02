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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { contactsFingerprint } from '../contactsFingerprint'

describe('contactsFingerprint', () => {
    it('is order-independent', () => {
        const contacts = [
            { addresses: { algorand: 'A' }, name: 'Alice' },
            { addresses: { algorand: 'B' }, name: 'Bob' },
        ]

        expect(contactsFingerprint(contacts)).toBe(
            contactsFingerprint([...contacts].reverse()),
        )
    })

    it('changes on a rename', () => {
        expect(
            contactsFingerprint([
                { addresses: { algorand: 'A' }, name: 'Alice' },
            ]),
        ).not.toBe(
            contactsFingerprint([
                { addresses: { algorand: 'A' }, name: 'Alicia' },
            ]),
        )
    })

    it('ignores the fields the backup does not carry', () => {
        expect(
            contactsFingerprint([
                {
                    addresses: { algorand: 'A' },
                    name: 'Alice',
                    image: 'file:///tmp/a.png',
                    nfd: 'alice.algo',
                },
            ]),
        ).toBe(
            contactsFingerprint([
                { addresses: { algorand: 'A' }, name: 'Alice' },
            ]),
        )
    })

    it('ignores a contact without an Algorand address', () => {
        const alice = { addresses: { algorand: 'A' }, name: 'Alice' }

        expect(
            contactsFingerprint([
                alice,
                { addresses: { ['other' as ChainFamily]: 'B' }, name: 'Bob' },
            ]),
        ).toBe(contactsFingerprint([alice]))
    })
})
