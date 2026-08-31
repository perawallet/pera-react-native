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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
// Type-only, so it survives the `vi.mock` below and still holds every fixture
// to the real payload schema — the drift this spec previously hid.
import type { PulledAccount } from '@perawallet/wallet-core-backup'

// --- hoisted mock state + spies -------------------------------------------

const {
    storeState,
    setAccountsMock,
    importAccountMock,
    updateAccountMock,
    persistHDMasterKeyMock,
    seedKeysState,
    hasSeedWithEntropyMock,
    getDerivedPublicKeyMock,
    generateDerivedKeyMock,
    encodeAlgorandAddressMock,
    generateMultisigAddressMock,
    isValidAlgorandAddressMock,
    hdDerivedKeyIdMock,
    callOrder,
    DuplicateAccountError,
} = vi.hoisted(() => {
    class DuplicateAccountError extends Error {
        constructor(address: string) {
            super(`Duplicate account: ${address}`)
            this.name = 'DuplicateAccountError'
        }
    }
    return {
        storeState: { accounts: [] as { address: string }[] },
        setAccountsMock: vi.fn(),
        importAccountMock: vi.fn(),
        updateAccountMock: vi.fn(),
        persistHDMasterKeyMock: vi.fn(),
        // The keystore's seed keys, as `useKMS().keys` exposes them.
        seedKeysState: { value: new Map<string, unknown>() },
        hasSeedWithEntropyMock: vi.fn(() => false),
        getDerivedPublicKeyMock: vi.fn(),
        generateDerivedKeyMock: vi.fn(),
        encodeAlgorandAddressMock: vi.fn(),
        generateMultisigAddressMock: vi.fn(),
        isValidAlgorandAddressMock: vi.fn(() => true),
        hdDerivedKeyIdMock: vi.fn(() => 'derived-key-id'),
        callOrder: [] as string[],
        DuplicateAccountError,
    }
})

vi.mock('@perawallet/wallet-core-accounts', () => {
    const useAccountsStore = (selector?: (s: unknown) => unknown) => {
        const state = {
            accounts: storeState.accounts,
            setAccounts: setAccountsMock,
        }
        return selector ? selector(state) : state
    }
    useAccountsStore.getState = () => ({ accounts: storeState.accounts })

    return {
        AccountTypes: {
            algo25: 'algo25',
            hdWallet: 'hdWallet',
            hardware: 'hardware',
            multisig: 'multisig',
            watch: 'watch',
            quantum: 'quantum',
        },
        DuplicateAccountError,
        useAccountsStore,
        useImportAccount: () => importAccountMock,
        useUpdateAccount: () => updateAccountMock,
    }
})

vi.mock('@perawallet/wallet-core-backup', () => ({
    BackupAccountType: {
        algo25: 'algo25',
        hdSeed: 'hdSeed',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        watch: 'watch',
        multisig: 'multisig',
        quantum: 'quantum',
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: encodeAlgorandAddressMock,
    generateMultisigAddress: generateMultisigAddressMock,
    isValidAlgorandAddress: isValidAlgorandAddressMock,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    hdDerivedKeyId: hdDerivedKeyIdMock,
    hexToBytes: (hex: string) => new Uint8Array(hex.length / 2),
    useKMS: () => ({
        keys: seedKeysState.value,
        hasSeedWithEntropy: hasSeedWithEntropyMock,
        persistHDMasterKey: persistHDMasterKeyMock,
        getDerivedPublicKey: getDerivedPublicKeyMock,
        generateDerivedKey: generateDerivedKeyMock,
    }),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Khovratovich: 32, Peikert: 9 },
}))

let idCounter = 0
vi.mock('@perawallet/wallet-core-shared', () => ({
    generateOrderedUniqueId: () => `id-${idCounter++}`,
    logger: { warn: vi.fn() },
}))

// Imported after mocks are registered.
import { useCloudBackupImport } from '../useCloudBackupImport'

// --- helpers ---------------------------------------------------------------

const renderImport = () => renderHook(() => useCloudBackupImport()).result

const A_HEX_96 = 'aa'.repeat(96)
const ENTROPY_HEX = 'bb'.repeat(32)

const watchAccount = (address: string): PulledAccount => ({
    address,
    addressPayload: { type: 'watch', address, customName: null },
    secretsPayload: null,
})

beforeEach(() => {
    vi.clearAllMocks()
    storeState.accounts = []
    idCounter = 0
    callOrder.length = 0
    seedKeysState.value = new Map()
    hasSeedWithEntropyMock.mockReturnValue(false)
    isValidAlgorandAddressMock.mockReturnValue(true)
    // Default: each append to the store updates the live accounts list so
    // subsequent duplicate checks see prior writes.
    setAccountsMock.mockImplementation((next: { address: string }[]) => {
        storeState.accounts = next
    })
    importAccountMock.mockImplementation(async () => {
        const account = { address: 'ALGO25_ADDR', type: 'algo25' }
        storeState.accounts = [...storeState.accounts, account]
        return account
    })
})

describe('useCloudBackupImport', () => {
    test('imports an algo25 account via the mnemonic import primitive', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'ALGO25_ADDR',
                addressPayload: {
                    type: 'algo25',
                    address: 'ALGO25_ADDR',
                    customName: 'My Algo25',
                },
                secretsPayload: { type: 'algo25', mnemonic: 'word word word' },
            },
        ])

        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonic: 'word word word',
            type: 'algo25',
        })
        expect(updateAccountMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Algo25' }),
        )
        expect(summary.imported).toBe(1)
        expect(summary.failed).toEqual([])
    })

    test('imports a quantum account through the same mnemonic primitive, counting both derivations', async () => {
        // The quantum import path probes on chain and can adopt BOTH the
        // canonical and legacy derivations off one mnemonic.
        importAccountMock.mockImplementation(async () => {
            const accounts = [
                { address: 'PQ_CANONICAL', type: 'quantum' },
                { address: 'PQ_LEGACY', type: 'quantum' },
            ]
            storeState.accounts = [...storeState.accounts, ...accounts]
            return accounts
        })
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'PQ_CANONICAL',
                addressPayload: {
                    type: 'quantum',
                    address: 'PQ_CANONICAL',
                    customName: 'My PQ',
                },
                secretsPayload: { type: 'quantum', mnemonic: 'pq words here' },
            },
        ])

        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonic: 'pq words here',
            type: 'quantum',
        })
        // The name belongs to the backed-up address, not to the sibling
        // derivation the probe happened to adopt alongside it.
        expect(updateAccountMock).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'PQ_CANONICAL', name: 'My PQ' }),
        )
        expect(updateAccountMock).toHaveBeenCalledTimes(1)
        expect(summary.imported).toBe(2)
        expect(summary.failed).toEqual([])
    })

    test('records a mnemonic-backed account whose secret is missing as failed', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'ALGO25_ADDR',
                addressPayload: {
                    type: 'algo25',
                    address: 'ALGO25_ADDR',
                    customName: null,
                },
                secretsPayload: null,
            },
        ])

        expect(importAccountMock).not.toHaveBeenCalled()
        expect(summary.imported).toBe(0)
        expect(summary.failed).toHaveLength(1)
        expect(summary.failed[0].address).toBe('ALGO25_ADDR')
    })

    test('appends a watch account via setAccounts', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            watchAccount('WATCH_ADDR'),
        ])

        expect(setAccountsMock).toHaveBeenCalledTimes(1)
        const appended = setAccountsMock.mock.calls[0][0]
        expect(appended).toContainEqual(
            expect.objectContaining({ address: 'WATCH_ADDR', type: 'watch' }),
        )
        expect(summary.imported).toBe(1)
    })

    test('rebuilds a hardware account from its device metadata', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'LEDGER_ADDR',
                addressPayload: {
                    type: 'hardware',
                    address: 'LEDGER_ADDR',
                    deviceId: 'DE:AD:BE:EF',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 3,
                    manufacturer: 'ledger',
                    transportType: 'ble',
                    customName: 'My Ledger',
                },
                secretsPayload: null,
            },
        ])

        const appended = setAccountsMock.mock.calls[0][0]
        expect(appended).toContainEqual(
            expect.objectContaining({
                address: 'LEDGER_ADDR',
                type: 'hardware',
                name: 'My Ledger',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'DE:AD:BE:EF',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 3,
                    transportType: 'ble',
                },
            }),
        )
        expect(summary.imported).toBe(1)
    })

    test('refuses a multisig account whose address does not re-derive', async () => {
        generateMultisigAddressMock.mockReturnValue('SOMETHING_ELSE')
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'MSIG_ADDR',
                addressPayload: {
                    type: 'multisig',
                    address: 'MSIG_ADDR',
                    participantAddresses: ['A', 'B'],
                    threshold: 2,
                    version: 1,
                    customName: null,
                },
                secretsPayload: null,
            },
        ])

        expect(setAccountsMock).not.toHaveBeenCalled()
        expect(summary.imported).toBe(0)
        expect(summary.failed).toHaveLength(1)
        expect(summary.failed[0].address).toBe('MSIG_ADDR')
    })

    test('skips an already-present address as skippedDuplicate, not imported', async () => {
        storeState.accounts = [{ address: 'WATCH_ADDR' }]
        const { current } = renderImport()

        const summary = await current.importAccounts([
            watchAccount('WATCH_ADDR'),
        ])

        expect(summary.skippedDuplicate).toBe(1)
        expect(summary.imported).toBe(0)
        expect(setAccountsMock).not.toHaveBeenCalled()
    })

    test('one failing account does not abort the batch and is recorded in failed', async () => {
        // First account is a watch account with an invalid address -> throws.
        isValidAlgorandAddressMock.mockImplementation(
            (addr?: string) => addr !== 'BAD_ADDR',
        )
        const { current } = renderImport()

        const summary = await current.importAccounts([
            watchAccount('BAD_ADDR'),
            watchAccount('GOOD_ADDR'),
        ])

        expect(summary.imported).toBe(1)
        expect(summary.failed).toHaveLength(1)
        expect(summary.failed[0].address).toBe('BAD_ADDR')
        expect(
            setAccountsMock.mock.calls.some(call =>
                call[0].some(
                    (a: { address: string }) => a.address === 'GOOD_ADDR',
                ),
            ),
        ).toBe(true)
    })

    test('persists the hdSeed master key before deriving the hdWallet child', async () => {
        persistHDMasterKeyMock.mockImplementation(async () => {
            callOrder.push('persistHDMasterKey')
        })
        // `getDerivedPublicKey` both derives AND persists the child key, so the
        // importer no longer calls `generateDerivedKey` separately. Track the
        // derive calls to assert the seed is persisted before the child derives.
        getDerivedPublicKeyMock.mockImplementation(async () => {
            callOrder.push('getDerivedPublicKey')
            return new Uint8Array([1, 2, 3])
        })
        // First derived (acc0/idx0) for the seed -> first-derived address;
        // the hdWallet child's coords -> its own address.
        encodeAlgorandAddressMock
            .mockReturnValueOnce('SEED_FIRST_DERIVED')
            .mockReturnValue('HD_KEY_ADDR')

        const { current } = renderImport()

        const summary = await current.importAccounts([
            // Provided hdWallet first to prove the hook reorders so the seed
            // persists before the key derives.
            {
                address: 'HD_KEY_ADDR',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'HD_KEY_ADDR',
                    seedFirstDerivedAddress: 'SEED_FIRST_DERIVED',
                    publicKey: 'pk',
                    account: 0,
                    change: 0,
                    keyIndex: 1,
                    derivationType: 9,
                    customName: 'HD One',
                },
                secretsPayload: null,
            },
            {
                address: 'SEED_ADDR',
                addressPayload: { type: 'hdSeed', address: 'SEED_ADDR' },
                secretsPayload: {
                    type: 'hdSeed',
                    seed: A_HEX_96,
                    entropy: ENTROPY_HEX,
                },
            },
        ])

        expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
        // The seed master key is persisted before the child is derived (the
        // last derive call corresponds to the child's own coords).
        expect(callOrder.indexOf('persistHDMasterKey')).toBeLessThan(
            callOrder.lastIndexOf('getDerivedPublicKey'),
        )
        // Only the hdWallet child surfaces as an imported account; the bare
        // seed does not.
        expect(summary.imported).toBe(1)
        expect(summary.failed).toEqual([])
        const appended = setAccountsMock.mock.calls.at(-1)?.[0]
        expect(appended).toContainEqual(
            expect.objectContaining({
                address: 'HD_KEY_ADDR',
                type: 'hdWallet',
                name: 'HD One',
            }),
        )
    })

    test('persists the seed carried on the first hdWallet account, then imports all HD children', async () => {
        getDerivedPublicKeyMock.mockImplementation(
            async (_seed: string, account: number, keyIndex: number) =>
                new Uint8Array([account, keyIndex]),
        )
        encodeAlgorandAddressMock.mockImplementation((pub: Uint8Array) =>
            pub[0] === 0 && pub[1] === 0 ? 'FIRST' : `ADDR-${pub[0]}-${pub[1]}`,
        )
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'FIRST',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'FIRST',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'aa',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: 'First',
                },
                secretsPayload: {
                    type: 'hdSeed',
                    seed: A_HEX_96,
                    entropy: ENTROPY_HEX,
                },
            },
            {
                address: 'ADDR-0-1',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'ADDR-0-1',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'bb',
                    account: 0,
                    change: 0,
                    keyIndex: 1,
                    derivationType: 9,
                    customName: 'Second',
                },
                secretsPayload: null,
            },
        ])

        expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
        expect(summary.imported).toBe(2)
        expect(summary.failed).toEqual([])
    })

    test('reuses an HD seed the wallet already holds instead of minting a second root', async () => {
        // The wallet already holds this seed: its acc0/idx0/Peikert child
        // derives to FIRST, which is what the backup names its seed secret by.
        seedKeysState.value = new Map([['held-seed', {}]])
        hasSeedWithEntropyMock.mockReturnValue(true)
        getDerivedPublicKeyMock.mockImplementation(
            async (_seed: string, account: number, keyIndex: number) =>
                new Uint8Array([account, keyIndex]),
        )
        encodeAlgorandAddressMock.mockImplementation((pub: Uint8Array) =>
            pub[0] === 0 && pub[1] === 0 ? 'FIRST' : `ADDR-${pub[0]}-${pub[1]}`,
        )
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'FIRST',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'FIRST',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'aa',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: 'First',
                },
                secretsPayload: {
                    type: 'hdSeed',
                    seed: A_HEX_96,
                    entropy: ENTROPY_HEX,
                },
            },
            {
                address: 'ADDR-0-1',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'ADDR-0-1',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'bb',
                    account: 0,
                    change: 0,
                    keyIndex: 1,
                    derivationType: 9,
                    customName: 'Second',
                },
                secretsPayload: null,
            },
        ])

        // No second HD root, and therefore no orphaned entropy child.
        expect(persistHDMasterKeyMock).not.toHaveBeenCalled()
        // The restored children bind to the seed already in the keystore.
        expect(hdDerivedKeyIdMock).toHaveBeenCalledWith('held-seed', 0, 0, 9)
        expect(hdDerivedKeyIdMock).toHaveBeenCalledWith('held-seed', 0, 1, 9)
        expect(summary.imported).toBe(2)
        expect(summary.failed).toEqual([])
    })

    test('imports the seed when the held seed derives to a different address', async () => {
        seedKeysState.value = new Map([['other-seed', {}]])
        hasSeedWithEntropyMock.mockReturnValue(true)
        getDerivedPublicKeyMock.mockImplementation(
            async (seed: string, account: number, keyIndex: number) =>
                // The held seed derives elsewhere; the restored one derives to FIRST.
                seed === 'other-seed'
                    ? new Uint8Array([9, 9])
                    : new Uint8Array([account, keyIndex]),
        )
        encodeAlgorandAddressMock.mockImplementation((pub: Uint8Array) =>
            pub[0] === 0 && pub[1] === 0 ? 'FIRST' : `ADDR-${pub[0]}-${pub[1]}`,
        )
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'FIRST',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'FIRST',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'aa',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: 'First',
                },
                secretsPayload: {
                    type: 'hdSeed',
                    seed: A_HEX_96,
                    entropy: ENTROPY_HEX,
                },
            },
        ])

        expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
        expect(summary.imported).toBe(1)
        expect(summary.failed).toEqual([])
    })

    test('records an hdSeed with a wrong-length seed as failed without aborting', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'SEED_ADDR',
                addressPayload: { type: 'hdSeed', address: 'SEED_ADDR' },
                // 95 bytes (190 hex chars) — not the expected 96-byte XHD root.
                secretsPayload: {
                    type: 'hdSeed',
                    seed: 'aa'.repeat(95),
                    entropy: ENTROPY_HEX,
                },
            },
            watchAccount('WATCH_ADDR'),
        ])

        expect(persistHDMasterKeyMock).not.toHaveBeenCalled()
        expect(summary.failed).toHaveLength(1)
        expect(summary.failed[0].address).toBe('SEED_ADDR')
        // The watch account after the bad seed still imports.
        expect(summary.imported).toBe(1)
    })

    test('a first hdWallet account with a corrupt seed is recorded as failed exactly once', async () => {
        const { current } = renderImport()
        const summary = await current.importAccounts([
            {
                address: 'FIRST',
                addressPayload: {
                    type: 'hdWallet',
                    address: 'FIRST',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: 'aa',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: 'First',
                },
                secretsPayload: {
                    type: 'hdSeed',
                    seed: 'aa'.repeat(95),
                    entropy: ENTROPY_HEX,
                },
            },
        ])
        const firstFailures = summary.failed.filter(f => f.address === 'FIRST')
        expect(firstFailures).toHaveLength(1)
        expect(summary.imported).toBe(0)
    })
})
