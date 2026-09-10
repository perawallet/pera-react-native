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
import { BackupItemType } from '../../models'
import { buildLocalContactItems } from '../buildLocalContactItems'

const contact = (address: string, name: string) => ({ address, name })

describe('buildLocalContactItems', () => {
    it('emits one CONTACT item per contact, keyed by address', () => {
        const items = buildLocalContactItems(
            [contact('A', 'Alice'), contact('B', 'Bob')],
            1000,
        )

        expect(items.map(item => item.key)).toEqual([
            'contacts/A',
            'contacts/B',
        ])
        expect(items[0].type).toBe(BackupItemType.CONTACT)
        expect(items[0].payload).toEqual({
            address: 'A',
            name: 'Alice',
            updatedAt: 1000,
        })
    })

    it('hashes content without updatedAt, so a timestamp bump is not a change', () => {
        const [early] = buildLocalContactItems([contact('A', 'Alice')], 1000)
        const [late] = buildLocalContactItems([contact('A', 'Alice')], 2000)

        expect(early.contentHash).toBe(late.contentHash)
    })

    it('leaves the device-only fields out of the payload', () => {
        const [item] = buildLocalContactItems(
            [
                {
                    address: 'A',
                    name: 'Alice',
                    image: 'file:///tmp/a.png',
                    nfd: 'alice.algo',
                },
            ],
            1000,
        )

        expect(item.payload).toEqual({
            address: 'A',
            name: 'Alice',
            updatedAt: 1000,
        })
    })

    it('renaming a contact changes its hash', () => {
        const [before] = buildLocalContactItems([contact('A', 'Alice')], 1000)
        const [after] = buildLocalContactItems([contact('A', 'Alicia')], 1000)

        expect(before.contentHash).not.toBe(after.contentHash)
    })
})
