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
import { contactsFingerprint } from '../contactsFingerprint'

describe('contactsFingerprint', () => {
    it('is order-independent', () => {
        const contacts = [
            { address: 'A', name: 'Alice' },
            { address: 'B', name: 'Bob' },
        ]

        expect(contactsFingerprint(contacts)).toBe(
            contactsFingerprint([...contacts].reverse()),
        )
    })

    it('changes on a rename', () => {
        expect(contactsFingerprint([{ address: 'A', name: 'Alice' }])).not.toBe(
            contactsFingerprint([{ address: 'A', name: 'Alicia' }]),
        )
    })

    it('ignores the fields the backup does not carry', () => {
        expect(
            contactsFingerprint([
                {
                    address: 'A',
                    name: 'Alice',
                    image: 'file:///tmp/a.png',
                    nfd: 'alice.algo',
                },
            ]),
        ).toBe(contactsFingerprint([{ address: 'A', name: 'Alice' }]))
    })
})
