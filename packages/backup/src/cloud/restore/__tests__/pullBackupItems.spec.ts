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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { encryptItemPayload } from '../../crypto/itemPayload'

const fetchManifest = vi.fn()
const fetchDelta = vi.fn()
const readItems = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchManifest: (...a: unknown[]) => fetchManifest(...a),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
    readItems: (...a: unknown[]) => readItems(...a),
}))

import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    accountItemKey,
    accountRecordItemKey,
    contactItemKey,
    contactRecordItemKey,
    secretsItemKey,
    settingsItemKey,
    SETTINGS_ITEM_ID,
    BackupAccountType,
} from '../../models'
import { pullBackupItems, buildPulledAccounts } from '../pullBackupItems'
import {
    registerAlgorandAccountsAdapter,
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const accountKey = (address: string) => accountItemKey(hashAddress(address))
const recordKey = (identity: string) =>
    accountRecordItemKey(hashAddress(identity))
const secretsKey = (address: string) => secretsItemKey(hashAddress(address))
const contactKey = (address: string) => contactItemKey(hashAddress(address))
const contactRecordKey = (id: string) => contactRecordItemKey(hashAddress(id))

const encKey = new Uint8Array(32).fill(7)
const backupId = 'did:pera:ADDR'
const enc = (key: string, plaintext: string) =>
    encryptItemPayload(plaintext, { encryptionKey: encKey, backupId, key })

const item = (key: string, payload: unknown) => ({
    key,
    ver: 1,
    hash: `h-${key}`,
    payload: enc(key, JSON.stringify(payload)),
})

const active = (ver: number, hash: string, lastSeq: number) => ({
    type: 'ACCOUNT',
    ver,
    status: 'ACTIVE',
    hash,
    lastSeq,
})

const pull = () =>
    pullBackupItems({
        backupId,
        deviceId: 'device-1',
        encryptionKey: encKey,
    })

describe('pullBackupItems on an account record', () => {
    const HD_IDENTITY = 'SEED/0/1'
    const hdRecord = {
        formatVersion: 2,
        customName: 'Both',
        updatedAt: 3,
        chains: [
            {
                chain: 'algorand',
                type: 'hdWallet',
                address: 'ALGO',
                seedFirstDerivedAddress: 'SEED',
                publicKey: 'aa',
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
            {
                chain: 'ethereum',
                type: 'hdChain',
                address: '0xabc',
                seedFirstDerivedAddress: 'SEED',
                account: 0,
                keyIndex: 1,
            },
        ],
    }

    const serving = (entries: [string, unknown][]) => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: entries.length,
            items: Object.fromEntries(
                entries.map(([key], index) => [
                    key,
                    active(1, `h${index}`, index + 1),
                ]),
            ),
        })
        readItems.mockResolvedValue(
            entries.map(([key, payload]) => item(key, payload)),
        )
    }

    beforeEach(() => {
        fetchManifest.mockReset()
        readItems.mockReset()
        registerFakeBackupAdapter()
        registerAlgorandAccountsAdapter()
        registerEthereumAccountsAdapter()
    })

    it('returns one entry per readable chain, in chain order, under one group', async () => {
        registerEthereumBackupChain()
        serving([[recordKey(HD_IDENTITY), hdRecord]])

        const result = await pull()

        expect(
            result.accounts.map(({ address, group, addressPayload }) => [
                address,
                group,
                addressPayload.type,
            ]),
        ).toEqual([
            ['ALGO', HD_IDENTITY, 'hdWallet'],
            ['0xabc', HD_IDENTITY, 'hdChain'],
        ])
        expect(result.trackedByKey[recordKey(HD_IDENTITY)]).toEqual({
            address: 'ALGO',
            addresses: ['ALGO', '0xabc'],
            accountType: 'hdWallet',
            record: hdRecord,
        })
    })

    it("joins a key's one secret to its record even when the chain it was filed under isn't one this client reads", async () => {
        registerEthereumBackupChain()
        const keyRecord = {
            formatVersion: 2,
            customName: 'Imported',
            updatedAt: 3,
            chains: [
                {
                    chain: 'base',
                    type: 'standaloneKey',
                    address: '0xkey',
                    enabledAt: 4,
                    enabledBy: 'user',
                },
                {
                    chain: 'ethereum',
                    type: 'standaloneKey',
                    address: '0xkey',
                    enabledAt: 2,
                    enabledBy: 'created',
                },
            ],
        }
        const secret = {
            type: 'standaloneKey',
            chain: 'base',
            address: '0xkey',
            privateKey: 'ab'.repeat(32),
        }
        serving([
            [recordKey('0xkey'), keyRecord],
            [secretsKey('0xkey'), secret],
        ])

        const result = await pull()

        expect(result.skipped).toEqual([])
        expect(
            result.accounts.map(({ chain, addressPayload, secretsPayload }) => [
                chain,
                addressPayload,
                secretsPayload,
            ]),
        ).toEqual([
            [
                'ethereum',
                expect.objectContaining({
                    type: 'standaloneKey',
                    enabledAt: 2,
                    enabledBy: 'created',
                }),
                secret,
            ],
        ])
    })

    it('restores only the chains this client reads, and still tracks every address', async () => {
        serving([[recordKey(HD_IDENTITY), hdRecord]])

        const result = await pull()

        expect(result.accounts.map(account => account.address)).toEqual([
            'ALGO',
        ])
        expect(result.trackedByKey[recordKey(HD_IDENTITY)]?.addresses).toEqual([
            'ALGO',
            '0xabc',
        ])
    })

    it('ignores a legacy item for an account the record covers', async () => {
        registerEthereumBackupChain()
        serving([
            [recordKey(HD_IDENTITY), hdRecord],
            [
                accountKey('ALGO'),
                {
                    type: 'hdWallet',
                    address: 'ALGO',
                    seedFirstDerivedAddress: 'SEED',
                    publicKey: 'aa',
                    account: 0,
                    change: 0,
                    keyIndex: 1,
                    derivationType: 9,
                    customName: 'Old name',
                },
            ],
        ])

        const result = await pull()

        expect(result.accounts.map(account => account.addressPayload)).toEqual([
            expect.objectContaining({ customName: 'Both' }),
            expect.objectContaining({ customName: 'Both' }),
        ])
    })

    it('returns a watch record on two chains as one account', async () => {
        registerEthereumBackupChain()
        serving([
            [
                recordKey('WALGO'),
                {
                    formatVersion: 2,
                    customName: null,
                    chains: [
                        { chain: 'algorand', type: 'watch', address: 'WALGO' },
                        { chain: 'ethereum', type: 'watch', address: '0xw' },
                    ],
                },
            ],
        ])

        const result = await pull()

        expect(
            result.accounts.map(({ group, addressPayload }) => [
                group,
                addressPayload.type,
            ]),
        ).toEqual([
            ['WALGO', 'watch'],
            ['WALGO', 'watch'],
        ])
    })

    it("keeps an entry of a kind its chain's adapter doesn't decode out of the restore, but tracks its address", async () => {
        registerEthereumBackupChain()
        serving([
            [
                recordKey(HD_IDENTITY),
                {
                    ...hdRecord,
                    chains: [
                        { ...hdRecord.chains[0], type: 'futureKind' },
                        hdRecord.chains[1],
                    ],
                },
            ],
        ])

        const result = await pull()

        expect(result.accounts.map(account => account.address)).toEqual([
            '0xabc',
        ])
        expect(result.trackedByKey[recordKey(HD_IDENTITY)]?.addresses).toEqual([
            'ALGO',
            '0xabc',
        ])
    })

    it('skips a record from a newer client and still tracks it', async () => {
        serving([[recordKey('NEW'), { ...hdRecord, formatVersion: 3 }]])

        const result = await pull()

        expect(result.accounts).toEqual([])
        expect(result.skipped).toEqual([
            { key: recordKey('NEW'), reason: 'newer' },
        ])
        expect(result.trackedByKey[recordKey('NEW')]?.address).toBe('ALGO')
    })
})

describe('pullBackupItems', () => {
    beforeEach(() => {
        fetchManifest.mockReset()
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it('groups a quantum account with its secret by address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 10,
            items: {
                [accountKey('QADDR')]: active(1, 'h1', 9),
                [secretsKey('QADDR')]: active(1, 'h2', 10),
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('QADDR'), {
                type: 'quantum',
                address: 'QADDR',
                customName: 'Quantum',
            }),
            item(secretsKey('QADDR'), {
                type: 'quantum',
                mnemonic: 'a b c',
                address: 'QADDR',
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'QADDR',
            addressPayload: { type: 'quantum', address: 'QADDR' },
            secretsPayload: {
                type: 'quantum',
                mnemonic: 'a b c',
                address: 'QADDR',
            },
        })
        expect(result.skipped).toHaveLength(0)
    })

    it('joins an account and its secret although both keys are opaque hashes', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 10,
            items: {
                [accountKey('ADDR')]: active(1, 'h1', 9),
                [secretsKey('ADDR')]: active(1, 'h2', 10),
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('ADDR'), {
                type: 'algo25',
                address: 'ADDR',
                customName: 'Main',
            }),
            item(secretsKey('ADDR'), {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            }),
        ])

        const result = await pull()

        expect(accountKey('ADDR')).not.toContain('ADDR')
        expect(result.lastSeq).toBe(10)
        expect(result.backupGlobalHash).toBe('sha256:global')
        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0]).toMatchObject({
            address: 'ADDR',
            addressPayload: { type: 'algo25', address: 'ADDR' },
            secretsPayload: {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            },
        })
        expect(result.skipped).toHaveLength(0)
    })

    // Retention prunes the changelog, and once it has, `from_seq=0` is rejected
    // like any other cursor behind the window — so a restore that read the
    // delta stream would fail permanently on exactly the busiest backups.
    it('reads the manifest alone, never the changelog', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('A')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([])

        await pull()

        expect(fetchDelta).not.toHaveBeenCalled()
        expect(readItems).toHaveBeenCalledWith(backupId, 'device-1', [
            accountKey('A'),
        ])
    })

    it('skips (does not throw) an item that fails to decrypt', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('BAD')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            {
                key: accountKey('BAD'),
                ver: 1,
                hash: 'h',
                payload: 'bm90LXZhbGlk',
            },
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: accountKey('BAD'), reason: 'decrypt' },
        ])
        expect(result.trackedByKey).toEqual({})
    })

    it('ignores IGNORED items (no read calls)', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 2,
            items: {
                [accountKey('B')]: {
                    type: 'ACCOUNT',
                    ver: 1,
                    status: 'IGNORED',
                    hash: 'h',
                    lastSeq: 2,
                },
            },
        })

        const result = await pull()

        expect(readItems).not.toHaveBeenCalled()
        expect(result.accounts).toHaveLength(0)
    })

    it('skips an item whose JSON fails to parse', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('P')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            {
                key: accountKey('P'),
                ver: 1,
                hash: 'h',
                payload: enc(accountKey('P'), '{not json'),
            },
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.skipped).toEqual([
            { key: accountKey('P'), reason: 'parse' },
        ])
    })

    it('skips a payload that names no address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 1,
            items: { [accountKey('NAMELESS')]: active(1, 'h', 1) },
        })
        readItems.mockResolvedValue([
            item(accountKey('NAMELESS'), {
                type: 'algo25',
                address: '',
                customName: null,
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(0)
        expect(result.trackedByKey).toEqual({})
        expect(result.skipped).toEqual([
            { key: accountKey('NAMELESS'), reason: 'parse' },
        ])
    })

    // The import path matches this address against the seeds the wallet already
    // holds; a hash matches nothing, and the restore then mints a second HD root
    // for a seed the user already has.
    it('restores an orphaned hdSeed under the address its payload names', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 3,
            items: { [secretsKey('FIRSTDERIVED')]: active(1, 'h', 3) },
        })
        readItems.mockResolvedValue([
            item(secretsKey('FIRSTDERIVED'), {
                type: 'hdSeed',
                seed: 'aa',
                entropy: 'bb',
                address: 'FIRSTDERIVED',
            }),
        ])

        const result = await pull()

        expect(result.accounts).toHaveLength(1)
        expect(result.accounts[0].address).toBe('FIRSTDERIVED')
        expect(result.accounts[0].addressPayload).toEqual({
            type: BackupAccountType.hdSeed,
            address: 'FIRSTDERIVED',
        })
    })

    it('reports what every item it read was filed under', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 5,
            items: {
                [accountKey('ADDR')]: active(1, 'h1', 3),
                [secretsKey('ADDR')]: active(1, 'h2', 4),
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h3',
                    lastSeq: 5,
                },
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('ADDR'), {
                type: 'algo25',
                address: 'ADDR',
                customName: null,
            }),
            item(secretsKey('ADDR'), {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            }),
            item(contactKey('CADDR'), {
                address: 'CADDR',
                name: 'Alice',
                updatedAt: 7,
            }),
        ])

        const result = await pull()

        expect(result.trackedByKey).toEqual({
            [accountKey('ADDR')]: { address: 'ADDR', accountType: 'algo25' },
            [secretsKey('ADDR')]: { address: 'ADDR', accountType: 'algo25' },
            [contactKey('CADDR')]: { address: 'CADDR', accountType: null },
        })
    })

    // The restore is a contact's only way home: it seeds the sync state at the
    // manifest's seq, so no later delta ever mentions an item that was already
    // in the backup when this device joined.
    it('reads contacts, so a restore is not the last time they are reachable', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 4,
            items: {
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 3,
                },
                [contactKey('GONE')]: {
                    type: 'CONTACT',
                    ver: 2,
                    status: 'IGNORED',
                    hash: 'h2',
                    lastSeq: 4,
                },
            },
        })
        readItems.mockResolvedValue([
            item(contactKey('CADDR'), {
                address: 'CADDR',
                name: 'Alice',
                updatedAt: 7,
            }),
        ])

        const result = await pull()

        expect(readItems).toHaveBeenCalledWith(backupId, 'device-1', [
            contactKey('CADDR'),
        ])
        expect(result.contacts).toEqual([
            {
                id: 'algorand:CADDR',
                addresses: { algorand: 'CADDR' },
                name: 'Alice',
            },
        ])
        expect(result.skipped).toHaveLength(0)
    })

    it('reads the settings item and keeps it apart from the address map', async () => {
        const key = settingsItemKey(hashAddress(SETTINGS_ITEM_ID))
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 2,
            items: {
                [key]: {
                    type: 'SETTINGS',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 2,
                },
            },
        })
        readItems.mockResolvedValue([
            item(key, {
                language: { value: 'de', updatedAt: 50 },
                confirmationMode: { value: 42, updatedAt: 50 },
            }),
        ])

        const result = await pull()

        // An unparseable field is dropped; the rest of the item survives.
        expect(result.settings).toEqual({
            key,
            payload: { language: { value: 'de', updatedAt: 50 } },
        })
        expect(result.trackedByKey).toEqual({})
    })

    it('skips an unreadable contact without sinking the pull', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 3,
            items: {
                [contactKey('CADDR')]: {
                    type: 'CONTACT',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 3,
                },
            },
        })
        readItems.mockResolvedValue([
            { key: contactKey('CADDR'), ver: 1, hash: 'h1', payload: 'AAAA' },
        ])

        const result = await pull()

        expect(result.contacts).toEqual([])
        expect(result.skipped).toEqual([
            { key: contactKey('CADDR'), reason: 'decrypt' },
        ])
    })

    it('pulls active passkey items and joins each to its secret', async () => {
        const record = {
            credentialId: 'Y3JlZC1pZA==',
            origin: 'webauthn.io',
            publicKeySpkiDer: 'cHVi',
            createdAt: 1,
        }
        const secret = { credentialId: 'Y3JlZC1pZA==', privateKey: 'a2V5' }
        const manifestItem = {
            type: 'PASSKEY',
            ver: 1,
            status: 'ACTIVE',
            hash: 'h1',
            lastSeq: 1,
        }
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 1,
            items: {
                'passkeys/Y3JlZC1pZA==': manifestItem,
                'passkey-secrets/Y3JlZC1pZA==': manifestItem,
                'passkeys/b3JwaGFu': manifestItem,
            },
        })
        readItems.mockResolvedValue([
            {
                key: 'passkeys/Y3JlZC1pZA==',
                ver: 1,
                hash: 'h1',
                payload: enc('passkeys/Y3JlZC1pZA==', JSON.stringify(record)),
            },
            {
                key: 'passkey-secrets/Y3JlZC1pZA==',
                ver: 1,
                hash: 'h1',
                payload: enc(
                    'passkey-secrets/Y3JlZC1pZA==',
                    JSON.stringify(secret),
                ),
            },
            {
                key: 'passkeys/b3JwaGFu',
                ver: 1,
                hash: 'h1',
                payload: enc(
                    'passkeys/b3JwaGFu',
                    JSON.stringify({ ...record, credentialId: 'b3JwaGFu' }),
                ),
            },
        ])

        const result = await pull()

        expect(result.passkeys).toEqual([
            { payload: record, secret },
            {
                payload: { ...record, credentialId: 'b3JwaGFu' },
                secret: null,
            },
        ])
        expect(
            result.trackedByKey['passkey-secrets/Y3JlZC1pZA==']?.address,
        ).toBe('Y3JlZC1pZA==')
    })

    it('records an unparseable passkey as skipped rather than throwing', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 1,
            items: {
                'passkeys/Y3JlZC1pZA==': {
                    type: 'PASSKEY',
                    ver: 1,
                    status: 'ACTIVE',
                    hash: 'h1',
                    lastSeq: 1,
                },
            },
        })
        readItems.mockResolvedValue([
            {
                key: 'passkeys/Y3JlZC1pZA==',
                ver: 1,
                hash: 'h1',
                payload: enc(
                    'passkeys/Y3JlZC1pZA==',
                    JSON.stringify({ nope: true }),
                ),
            },
        ])

        const result = await pull()

        expect(result.passkeys).toEqual([])
        expect(result.skipped.length).toBeGreaterThan(0)
    })
})

describe('pullBackupItems manifest pass-through', () => {
    beforeEach(() => {
        fetchManifest.mockReset()
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it('returns every key the manifest holds, not just the ones it read', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 4,
            items: {
                [accountKey('A')]: active(2, 'h1', 3),
                [accountKey('GONE')]: {
                    type: 'ACCOUNT',
                    ver: 5,
                    status: 'IGNORED',
                    hash: 'h2',
                    lastSeq: 4,
                },
            },
        })
        // Only the ACTIVE key is downloaded; the tombstone still has to be
        // tracked or the next push offers it to the server as brand new.
        readItems.mockResolvedValue([])

        const result = await pull()

        expect(readItems).toHaveBeenCalledWith(backupId, 'device-1', [
            accountKey('A'),
        ])
        expect(Object.keys(result.manifestItems)).toEqual([
            accountKey('A'),
            accountKey('GONE'),
        ])
        expect(result.manifestItems[accountKey('GONE')].ver).toBe(5)
    })
})

// A newer client can write kinds this one has never heard of; the backup must
// still restore everything this client does know.
describe('pullBackupItems with an item kind it does not know', () => {
    beforeEach(() => {
        fetchManifest.mockReset()
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it("passes an account kind the format doesn't define on to the chain's import, skipping nothing", async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 4,
            items: {
                [accountKey('ADDR')]: active(1, 'h1', 1),
                [secretsKey('ADDR')]: active(1, 'h2', 2),
                [contactKey('CADDR')]: {
                    ...active(1, 'h3', 3),
                    type: 'CONTACT',
                },
                [accountKey('FIXADDR')]: active(1, 'h4', 4),
            },
        })
        readItems.mockResolvedValue([
            item(accountKey('ADDR'), {
                type: 'algo25',
                address: 'ADDR',
                customName: 'Main',
            }),
            item(secretsKey('ADDR'), {
                type: 'algo25',
                mnemonic: 'a b c',
                address: 'ADDR',
            }),
            item(contactKey('CADDR'), { address: 'CADDR', name: 'Alice' }),
            item(accountKey('FIXADDR'), {
                type: 'fixtureChainAccount',
                address: 'FIXADDR',
                updatedAt: 1,
            }),
        ])

        const result = await pull()

        expect(result.accounts).toEqual([
            {
                address: 'ADDR',
                group: 'ADDR',
                addressPayload: {
                    type: 'algo25',
                    address: 'ADDR',
                    customName: 'Main',
                },
                secretsPayload: {
                    type: 'algo25',
                    mnemonic: 'a b c',
                    address: 'ADDR',
                },
            },
            {
                address: 'FIXADDR',
                group: 'FIXADDR',
                addressPayload: {
                    type: 'fixtureChainAccount',
                    address: 'FIXADDR',
                    customName: null,
                    updatedAt: 1,
                },
                secretsPayload: null,
            },
        ])
        expect(result.contacts).toEqual([
            {
                id: 'algorand:CADDR',
                addresses: { algorand: 'CADDR' },
                name: 'Alice',
            },
        ])
        expect(result.skipped).toEqual([])
        expect(result.manifestItems).toHaveProperty([accountKey('FIXADDR')])
    })

    it('never reads an item under a key prefix it does not know, and keeps it in the manifest', async () => {
        const unknownKey = `fixture-kind/${hashAddress('FIXADDR')}`
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: 2,
            items: {
                [accountKey('WADDR')]: active(1, 'h1', 1),
                [unknownKey]: active(1, 'h2', 2),
            },
        })
        const stored = [
            item(accountKey('WADDR'), { type: 'watch', address: 'WADDR' }),
            item(unknownKey, { address: 'FIXADDR' }),
        ]
        // Serves only what was asked for, so a read of the unknown key would
        // come back and surface as a skip.
        readItems.mockImplementation(
            async (_backupId, _deviceId, keys: string[]) =>
                stored.filter(entry => keys.includes(entry.key)),
        )

        const result = await pull()

        expect(readItems).toHaveBeenCalledTimes(1)
        expect(readItems).toHaveBeenCalledWith(backupId, 'device-1', [
            accountKey('WADDR'),
        ])
        expect(result.accounts.map(account => account.address)).toEqual([
            'WADDR',
        ])
        expect(result.skipped).toEqual([])
        expect(result.manifestItems).toHaveProperty([unknownKey])
    })
})

describe('buildPulledAccounts', () => {
    const seedSecret = {
        type: 'hdSeed',
        seed: 's',
        entropy: 'e',
        address: 'F',
    } as const

    it('attaches a hdSeed secret to its matching hdWallet account', () => {
        const result = buildPulledAccounts({
            records: [],
            addressPayloads: new Map([
                [
                    'F',
                    {
                        type: 'hdWallet',
                        address: 'F',
                        seedFirstDerivedAddress: 'F',
                        publicKey: 'aa',
                        account: 0,
                        change: 0,
                        keyIndex: 0,
                        derivationType: 9,
                        customName: null,
                    },
                ],
            ]),
            secretsPayloads: new Map([['F', seedSecret]]),
        })

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            group: 'F/0/0',
            addressPayload: { type: 'hdWallet' },
            secretsPayload: { type: 'hdSeed' },
        })
    })

    it('synthesizes a standalone hdSeed entry for an orphan seed secret', () => {
        const result = buildPulledAccounts({
            records: [],
            addressPayloads: new Map(),
            secretsPayloads: new Map([['F', seedSecret]]),
        })

        expect(result).toEqual([
            {
                address: 'F',
                group: 'F',
                addressPayload: {
                    type: BackupAccountType.hdSeed,
                    address: 'F',
                },
                secretsPayload: seedSecret,
            },
        ])
    })

    it('attaches the seed to the record entry filed under the seed address', () => {
        registerFakeBackupAdapter()
        registerAlgorandAccountsAdapter()
        const result = buildPulledAccounts({
            records: [
                {
                    formatVersion: 2,
                    customName: null,
                    chains: [
                        {
                            chain: 'algorand',
                            type: 'hdWallet',
                            address: 'F',
                            seedFirstDerivedAddress: 'F',
                            publicKey: 'aa',
                            account: 0,
                            change: 0,
                            keyIndex: 0,
                            derivationType: 9,
                        },
                    ],
                },
            ],
            addressPayloads: new Map(),
            secretsPayloads: new Map([['F', seedSecret]]),
        })

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            group: 'F/0/0',
            secretsPayload: { type: 'hdSeed' },
        })
    })
})

describe('pullBackupItems on a contact record', () => {
    const record = {
        formatVersion: 1,
        id: 'id-1',
        name: 'Alice',
        updatedAt: 3,
        addresses: [
            { family: 'evm', address: '0xB' },
            { family: 'algorand', address: 'A' },
        ],
    }

    const serving = (entries: [string, unknown][]) => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'sha256:global',
            lastSeq: entries.length,
            items: Object.fromEntries(
                entries.map(([key], index) => [
                    key,
                    { ...active(1, `h${index}`, index + 1), type: 'CONTACT' },
                ]),
            ),
        })
        readItems.mockResolvedValue(
            entries.map(([key, payload]) => item(key, payload)),
        )
    }

    beforeEach(() => {
        fetchManifest.mockReset()
        readItems.mockReset()
    })

    it('reads a record and joins every family into one contact', async () => {
        serving([[contactRecordKey('id-1'), record]])

        const result = await pull()

        expect(readItems).toHaveBeenCalledWith(backupId, 'device-1', [
            contactRecordKey('id-1'),
        ])
        expect(result.contacts).toEqual([
            {
                id: 'id-1',
                name: 'Alice',
                addresses: { algorand: 'A', evm: '0xB' },
            },
        ])
        expect(result.skipped).toEqual([])
    })

    it('hands the importer the families the record says were removed', async () => {
        serving([
            [
                contactRecordKey('id-1'),
                {
                    ...record,
                    addresses: [{ family: 'algorand', address: 'A' }],
                    removed: ['evm'],
                },
            ],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([
            {
                id: 'id-1',
                name: 'Alice',
                addresses: { algorand: 'A' },
                removedFamilies: ['evm'],
            },
        ])
    })

    it('caches what the record is filed under, with its content and label', async () => {
        serving([[contactRecordKey('id-1'), record]])

        const result = await pull()

        expect(result.trackedByKey).toEqual({
            [contactRecordKey('id-1')]: {
                address: 'A',
                addresses: ['A', '0xB'],
                accountType: null,
                label: 'Alice',
                record: expect.objectContaining({ name: 'Alice' }),
            },
        })
    })

    it('restores one contact from a record and a legacy item of it, the record winning', async () => {
        serving([
            [contactKey('A'), { address: 'A', name: 'Old name' }],
            [contactRecordKey('id-1'), record],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([
            {
                id: 'id-1',
                name: 'Alice',
                addresses: { algorand: 'A', evm: '0xB' },
            },
        ])
    })

    it('restores only the record when its contact was migrated from a legacy item whose address it has since changed', async () => {
        const migrated = {
            ...record,
            id: 'algorand:A',
            addresses: [{ family: 'algorand', address: 'A2' }],
        }
        serving([
            [contactKey('A'), { address: 'A', name: 'Old name' }],
            [contactRecordKey('algorand:A'), migrated],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([
            { id: 'algorand:A', name: 'Alice', addresses: { algorand: 'A2' } },
        ])
    })

    it('gives each record its own contact, though they share an address', async () => {
        const other = {
            ...record,
            id: 'id-2',
            name: 'Alice B',
            addresses: [{ family: 'evm', address: '0xB' }],
        }
        serving([
            [contactRecordKey('id-2'), other],
            [contactRecordKey('id-1'), record],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([
            { id: 'id-2', name: 'Alice B', addresses: { evm: '0xB' } },
            {
                id: 'id-1',
                name: 'Alice',
                addresses: { algorand: 'A', evm: '0xB' },
            },
        ])
    })

    it('restores a legacy item no record covers as an algorand contact', async () => {
        serving([
            [contactKey('Z'), { address: 'Z', name: 'Zed' }],
            [contactRecordKey('id-1'), record],
        ])

        const result = await pull()

        expect(result.contacts).toHaveLength(2)
        expect(result.contacts).toContainEqual({
            id: 'algorand:Z',
            name: 'Zed',
            addresses: { algorand: 'Z' },
        })
    })

    it('tracks a record from a newer format and skips it as newer', async () => {
        serving([[contactRecordKey('id-1'), { ...record, formatVersion: 2 }]])

        const result = await pull()

        expect(result.contacts).toEqual([])
        expect(result.skipped).toEqual([
            { key: contactRecordKey('id-1'), reason: 'newer' },
        ])
        expect(result.trackedByKey[contactRecordKey('id-1')]).toMatchObject({
            record: { formatVersion: 2 },
        })
    })

    it('tracks a record of unknown families only without creating a contact', async () => {
        serving([
            [
                contactRecordKey('id-1'),
                { ...record, addresses: [{ family: 'solana', address: 'S' }] },
            ],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([])
        expect(result.trackedByKey[contactRecordKey('id-1')]).toMatchObject({
            address: 'S',
        })
    })

    it('keeps an unknown family out of the contact but in the cached record', async () => {
        serving([
            [
                contactRecordKey('id-1'),
                {
                    ...record,
                    addresses: [
                        { family: 'algorand', address: 'A' },
                        { family: 'solana', address: 'S' },
                    ],
                },
            ],
        ])

        const result = await pull()

        expect(result.contacts).toEqual([
            { id: 'id-1', name: 'Alice', addresses: { algorand: 'A' } },
        ])
        expect(
            result.trackedByKey[contactRecordKey('id-1')]?.addresses,
        ).toEqual(['A', 'S'])
    })
})
