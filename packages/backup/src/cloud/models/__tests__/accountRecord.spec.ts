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
    accountRecordEntries,
    accountRecordIdentity,
    accountRecordSeedReference,
    accountRecordType,
    cachedRecordOverview,
    isNewerAccountRecord,
    mergeAccountRecord,
    orderAccountRecordChains,
    type AccountRecordEntry,
} from '../accountRecord'
import { accountIdentityOf, type AccountRecordPayload } from '../payloads'

const hdWalletEntry = {
    chain: 'algorand',
    type: 'hdWallet',
    address: 'ALGO',
    seedFirstDerivedAddress: 'SEED',
    publicKey: 'aa',
    account: 1,
    change: 0,
    keyIndex: 3,
    derivationType: 9,
}
const hdChainEntry = {
    chain: 'ethereum',
    type: 'hdChain',
    address: '0xeth',
    seedFirstDerivedAddress: 'SEED',
    account: 1,
    keyIndex: 3,
}

const recordOf = (
    chains: AccountRecordPayload['chains'],
    over: Partial<AccountRecordPayload> = {},
): AccountRecordPayload => ({
    formatVersion: 2,
    customName: 'Name',
    updatedAt: 7,
    chains,
    ...over,
})

const readAll = () => true

describe('accountRecordEntries', () => {
    it('reads each entry as its chain item, named and stamped by the record', () => {
        const entries = accountRecordEntries(
            recordOf([hdWalletEntry, hdChainEntry]),
            readAll,
        )

        expect(entries).toEqual([
            {
                chain: 'algorand',
                payload: {
                    type: 'hdWallet',
                    address: 'ALGO',
                    seedFirstDerivedAddress: 'SEED',
                    publicKey: 'aa',
                    account: 1,
                    change: 0,
                    keyIndex: 3,
                    derivationType: 9,
                    customName: 'Name',
                    updatedAt: 7,
                },
            },
            {
                chain: 'ethereum',
                payload: {
                    type: 'hdChain',
                    address: '0xeth',
                    seedFirstDerivedAddress: 'SEED',
                    account: 1,
                    keyIndex: 3,
                    customName: 'Name',
                    updatedAt: 7,
                },
            },
        ])
    })

    it.each([
        [
            'standaloneKey',
            { chain: 'ethereum', type: 'standaloneKey', address: '0xk' },
        ],
        ['watch', { chain: 'ethereum', type: 'watch', address: '0xw' }],
        [
            'hardware',
            {
                chain: 'algorand',
                type: 'hardware',
                address: 'L',
                deviceId: 'd',
                deviceName: 'n',
                accountIndex: 2,
                manufacturer: 'ledger',
                transportType: 'ble',
            },
        ],
        [
            'multisig',
            {
                chain: 'algorand',
                type: 'multisig',
                address: 'M',
                participantAddresses: ['A', 'B'],
                threshold: 1,
                version: 1,
            },
        ],
        ['algo25', { chain: 'algorand', type: 'algo25', address: 'A' }],
    ])('reads a %s entry', (type, entry) => {
        const [read] = accountRecordEntries(recordOf([entry]), readAll)

        expect(read?.payload).toMatchObject({ type, address: entry.address })
    })

    it('skips an entry the caller cannot restore, and keeps the rest', () => {
        const canRead = ({ chain }: AccountRecordEntry) => chain !== 'ethereum'

        const entries = accountRecordEntries(
            recordOf([hdWalletEntry, hdChainEntry]),
            canRead,
        )

        expect(entries.map(({ chain }) => chain)).toEqual(['algorand'])
    })

    it('skips an entry that does not parse as an item', () => {
        const entries = accountRecordEntries(
            recordOf([
                { chain: 'ethereum', type: 'hdChain', address: '0xbad' },
                hdWalletEntry,
            ]),
            readAll,
        )

        expect(entries.map(({ chain }) => chain)).toEqual(['algorand'])
    })

    it('yields nothing for a record with a newer format version', () => {
        expect(
            accountRecordEntries(
                recordOf([hdWalletEntry], { formatVersion: 3 }),
                readAll,
            ),
        ).toEqual([])
    })
})

describe('isNewerAccountRecord', () => {
    it('is true for cached content a newer client wrote', () => {
        expect(
            isNewerAccountRecord(
                recordOf([hdWalletEntry], { formatVersion: 3 }),
            ),
        ).toBe(true)
    })

    it.each([
        ['this build wrote', recordOf([hdWalletEntry])],
        ['is absent', undefined],
    ])('is false for content %s', (_label, record) => {
        expect(isNewerAccountRecord(record)).toBe(false)
    })
})

describe('cachedRecordOverview', () => {
    it('lists each chain the record holds with its address, in record order', () => {
        expect(
            cachedRecordOverview(recordOf([hdWalletEntry, hdChainEntry])),
        ).toEqual({
            needsUpdate: false,
            chains: [
                { chain: 'algorand', address: 'ALGO' },
                { chain: 'ethereum', address: '0xeth' },
            ],
        })
    })

    it("still lists a newer client's chains, and marks the record as needing an update", () => {
        expect(
            cachedRecordOverview(
                recordOf([hdChainEntry], { formatVersion: 3 }),
            ),
        ).toEqual({
            needsUpdate: true,
            chains: [{ chain: 'ethereum', address: '0xeth' }],
        })
    })

    it.each([
        ['is absent', undefined],
        ['is not a record', { chains: 'nope' }],
    ])('is empty when the content %s', (_label, record) => {
        expect(cachedRecordOverview(record)).toEqual({
            needsUpdate: false,
            chains: [],
        })
    })
})

describe('accountRecordIdentity', () => {
    it('is the seed position for an HD record, whatever chain carries it', () => {
        expect(accountRecordIdentity(recordOf([hdChainEntry]))).toBe('SEED/1/3')
        expect(
            accountRecordIdentity(recordOf([hdWalletEntry, hdChainEntry])),
        ).toBe('SEED/1/3')
    })

    it('agrees with the legacy item of the same account', () => {
        const legacy = { ...hdWalletEntry, customName: null }

        expect(accountRecordIdentity(recordOf([hdWalletEntry]))).toBe(
            accountIdentityOf(legacy as never),
        )
        expect(
            accountRecordIdentity(
                recordOf([{ chain: 'algorand', type: 'watch', address: 'W' }]),
            ),
        ).toBe('W')
    })
})

describe('accountRecordSeedReference', () => {
    it('is the seed of an HD record and null otherwise', () => {
        expect(accountRecordSeedReference(recordOf([hdChainEntry]))).toBe(
            'SEED',
        )
        expect(
            accountRecordSeedReference(
                recordOf([{ chain: 'algorand', type: 'watch', address: 'W' }]),
            ),
        ).toBeNull()
    })
})

describe('accountRecordType', () => {
    it('prefers a kind a chain adapter owns', () => {
        expect(accountRecordType(recordOf([hdChainEntry, hdWalletEntry]))).toBe(
            'hdWallet',
        )
    })

    it('falls back to the first entry kind', () => {
        expect(accountRecordType(recordOf([hdChainEntry]))).toBe('hdChain')
    })
})

describe('orderAccountRecordChains', () => {
    it('orders by chain id', () => {
        expect(
            orderAccountRecordChains([hdChainEntry, hdWalletEntry]).map(
                ({ chain }) => chain,
            ),
        ).toEqual(['algorand', 'ethereum'])
    })
})

describe('mergeAccountRecord', () => {
    const local = recordOf([{ ...hdWalletEntry, publicKey: 'bb' }], {
        customName: 'Renamed',
    })

    it('is the local record when nothing was seen remotely', () => {
        expect(mergeAccountRecord(undefined, local)).toBe(local)
    })

    it('keeps a top-level field this build does not know', () => {
        const merged = mergeAccountRecord(
            { ...recordOf([hdWalletEntry]), futureField: 1 },
            local,
        )

        expect(merged).toMatchObject({ futureField: 1, customName: 'Renamed' })
    })

    it('keeps a chain the account lacks here', () => {
        const merged = mergeAccountRecord(
            recordOf([hdWalletEntry, hdChainEntry]),
            local,
        )

        expect(merged.chains.map(({ chain }) => chain)).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    it('lays local fields over the remote entry of the same chain, keeping its unknown ones', () => {
        const merged = mergeAccountRecord(
            recordOf([{ ...hdWalletEntry, futureEntryField: 'x' }]),
            local,
        )

        expect(merged.chains[0]).toMatchObject({
            publicKey: 'bb',
            futureEntryField: 'x',
        })
    })

    it('orders the merged chains by chain id', () => {
        const merged = mergeAccountRecord(
            recordOf([hdChainEntry]),
            recordOf([hdWalletEntry]),
        )

        expect(merged.chains.map(({ chain }) => chain)).toEqual([
            'algorand',
            'ethereum',
        ])
    })
})
