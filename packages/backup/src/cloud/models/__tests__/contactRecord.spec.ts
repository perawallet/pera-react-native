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

import { describe, expect, it } from 'vitest'
import {
    contactAddressEntries,
    contactBackupAddresses,
    contactRecordAddresses,
    contactRecordEntries,
    isNewerContactRecord,
    mergeContactRecord,
    orderContactRecordAddresses,
} from '../contactRecord'
import {
    CONTACT_RECORD_FORMAT_VERSION,
    type ContactRecordPayload,
} from '../payloads'

const recordOf = (
    addresses: ContactRecordPayload['addresses'],
    over: Partial<ContactRecordPayload> = {},
): ContactRecordPayload => ({
    formatVersion: CONTACT_RECORD_FORMAT_VERSION,
    name: 'Alice',
    updatedAt: 1,
    addresses,
    ...over,
})

const algorand = { family: 'algorand', address: 'A' }
const evm = { family: 'evm', address: '0xB' }
const solana = { family: 'solana', address: 'S' }

describe('contactAddressEntries', () => {
    it('lists the non-empty addresses in family order, whatever the insertion order', () => {
        expect(contactAddressEntries({ evm: '0xB', algorand: 'A' })).toEqual([
            { family: 'algorand', address: 'A' },
            { family: 'evm', address: '0xB' },
        ])
    })

    it('leaves out an empty address', () => {
        expect(contactAddressEntries({ algorand: '', evm: '0xB' })).toEqual([
            { family: 'evm', address: '0xB' },
        ])
    })
})

describe('contactBackupAddresses', () => {
    it('puts the algorand address first, so it names the record', () => {
        expect(
            contactBackupAddresses({
                addresses: { evm: '0xB', algorand: 'A' },
            }),
        ).toEqual(['A', '0xB'])
    })

    it('names an EVM-only contact by its EVM address', () => {
        expect(contactBackupAddresses({ addresses: { evm: '0xB' } })).toEqual([
            '0xB',
        ])
    })
})

describe('orderContactRecordAddresses', () => {
    it('sorts known families by their position, and keeps unknown ones in the order they came', () => {
        const ordered = orderContactRecordAddresses([
            { family: 'zeta' },
            evm,
            { family: 'alpha' },
            algorand,
        ])

        expect(ordered.map(entry => entry.family)).toEqual([
            'algorand',
            'evm',
            'zeta',
            'alpha',
        ])
    })
})

describe('contactRecordEntries', () => {
    it('returns the families this build knows, in order', () => {
        expect(contactRecordEntries(recordOf([evm, solana, algorand]))).toEqual(
            [
                { family: 'algorand', address: 'A' },
                { family: 'evm', address: '0xB' },
            ],
        )
    })

    it('returns nothing for a record a newer client wrote', () => {
        expect(
            contactRecordEntries(recordOf([algorand], { formatVersion: 2 })),
        ).toEqual([])
    })

    it('returns nothing for a record of unknown families only', () => {
        expect(contactRecordEntries(recordOf([solana]))).toEqual([])
    })
})

describe('contactRecordAddresses', () => {
    it('includes an unknown family, after the known ones', () => {
        expect(
            contactRecordAddresses(recordOf([solana, evm, algorand])),
        ).toEqual(['A', '0xB', 'S'])
    })
})

describe('mergeContactRecord', () => {
    it('is the local record when nothing was seen remotely', () => {
        const local = recordOf([algorand])

        expect(mergeContactRecord(null, local)).toBe(local)
    })

    it('keeps a family this build does not know', () => {
        const merged = mergeContactRecord(
            recordOf([algorand, solana]),
            recordOf([algorand], { name: 'Alicia' }),
        )

        expect(merged.name).toBe('Alicia')
        expect(merged.addresses).toEqual([algorand, solana])
    })

    it("writes back a newer client's unknown families in that client's order", () => {
        const bitcoin = { family: 'bitcoin', address: 'bc1' }
        const remote = recordOf([algorand, evm, solana, bitcoin])

        const merged = mergeContactRecord(remote, recordOf([algorand, evm]))

        expect(merged.addresses).toEqual(remote.addresses)
    })

    it('keeps a field this build does not know', () => {
        const merged = mergeContactRecord(
            { ...recordOf([algorand]), nickname: 'Al' },
            recordOf([algorand]),
        )

        expect(merged).toMatchObject({ nickname: 'Al' })
    })

    it('keeps a remote family the local contact lacks', () => {
        const merged = mergeContactRecord(
            recordOf([algorand, evm]),
            recordOf([algorand]),
        )

        expect(merged.addresses).toEqual([algorand, evm])
    })

    it('lets the local address win within a family', () => {
        const merged = mergeContactRecord(
            recordOf([algorand, { ...evm, address: '0xOLD' }]),
            recordOf([algorand, evm]),
        )

        expect(merged.addresses).toEqual([algorand, evm])
    })

    it('keeps what a newer client added to an entry the local record rewrites', () => {
        const merged = mergeContactRecord(
            recordOf([{ ...evm, label: 'hot' }]),
            recordOf([{ ...evm, address: '0xNEW' }]),
        )

        expect(merged.addresses).toEqual([
            { family: 'evm', address: '0xNEW', label: 'hot' },
        ])
    })

    it('writes the families in a fixed order', () => {
        const merged = mergeContactRecord(
            recordOf([solana, evm]),
            recordOf([evm, algorand]),
        )

        expect(merged.addresses.map(entry => entry.family)).toEqual([
            'algorand',
            'evm',
            'solana',
        ])
    })
})

describe('isNewerContactRecord', () => {
    it('is true for a record of a higher format version', () => {
        expect(
            isNewerContactRecord(recordOf([algorand], { formatVersion: 2 })),
        ).toBe(true)
    })

    it('is false for a record of this version', () => {
        expect(isNewerContactRecord(recordOf([algorand]))).toBe(false)
    })

    it('is false for no cached record, or one that is not a contact record', () => {
        expect(isNewerContactRecord(undefined)).toBe(false)
        expect(isNewerContactRecord(null)).toBe(false)
        expect(
            isNewerContactRecord({
                formatVersion: 9,
                chains: [{ chain: 'x' }],
            }),
        ).toBe(false)
    })
})
