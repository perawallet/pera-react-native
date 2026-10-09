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
import type { PulledAccount } from '../../restore/pullBackupItems'

// --- hoisted mock state + spies -------------------------------------------

const {
    storeState,
    addChainAccountMock,
    importAccountFromPrivateKeyMock,
    findPathHolderMock,
    setAccountsMock,
    importAccountMock,
    updateAccountMock,
    persistHDMasterKeyMock,
    seedKeysState,
    hasSeedWithEntropyMock,
    seedReferenceMock,
    deriveHdAccountMock,
    deriveMultisigAddressMock,
    isValidAddressMock,
    callOrder,
    DuplicateAccountError,
    MOCK_WORDLIST,
} = vi.hoisted(() => {
    class DuplicateAccountError extends Error {
        constructor(address: string) {
            super(`Duplicate account: ${address}`)
            this.name = 'DuplicateAccountError'
        }
    }
    return {
        storeState: { accounts: [] as { address: string }[] },
        addChainAccountMock: vi.fn(),
        importAccountFromPrivateKeyMock: vi.fn(),
        findPathHolderMock: vi.fn(),
        setAccountsMock: vi.fn(),
        importAccountMock: vi.fn(),
        updateAccountMock: vi.fn(),
        persistHDMasterKeyMock: vi.fn(),
        // The keystore's seed keys, as `useKMS().keys` exposes them.
        seedKeysState: { value: new Map<string, unknown>() },
        hasSeedWithEntropyMock: vi.fn(() => false),
        seedReferenceMock: vi.fn(),
        deriveHdAccountMock: vi.fn(),
        deriveMultisigAddressMock: vi.fn(),
        isValidAddressMock: vi.fn((_address?: string) => true),
        callOrder: [] as string[],
        DuplicateAccountError,
        MOCK_WORDLIST: [
            'abandon',
            'ability',
            'able',
            'about',
            'above',
            'absent',
        ],
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const { buildAccount } = await vi.importActual<
        Pick<typeof import('@perawallet/wallet-core-accounts'), 'buildAccount'>
    >('@perawallet/wallet-core-accounts/build-account')
    // Same source module as `buildAccount`, so they share one registry.
    const { accountsChainAdapters } = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts/chain-adapter')
    const { stubAccountsAdapter } =
        await import('../../../__tests__/stubAccountsAdapter')
    accountsChainAdapters.register(stubAccountsAdapter)
    accountsChainAdapters.register({
        ...stubAccountsAdapter,
        chainId: 'ethereum',
    })
    const useAccountsStore = (selector?: (s: unknown) => unknown) => {
        const state = {
            accounts: storeState.accounts,
            setAccounts: setAccountsMock,
        }
        return selector ? selector(state) : state
    }
    useAccountsStore.getState = () => ({
        accounts: storeState.accounts,
        addChainAccount: addChainAccountMock,
        importAccountFromPrivateKey: importAccountFromPrivateKeyMock,
    })

    return {
        AccountTypes: {
            standalone: 'standalone',
            hdWallet: 'hdWallet',
            hardware: 'hardware',
            multisig: 'multisig',
            watch: 'watch',
            quantum: 'quantum',
        },
        buildAccount,
        // The legacy chain answers for a record that predates `chains`.
        chainAccountOf: (
            account: {
                address?: string
                chains?: Record<string, { address: string } | undefined>
            },
            chainId: string,
        ) =>
            account.chains
                ? account.chains[chainId]
                : chainId === 'algorand' && account.address
                  ? { address: account.address }
                  : undefined,
        findPathHolder: findPathHolderMock,
        isSameAddress: (_chainId: string, a: string, b: string) => a === b,
        DuplicateAccountError,
        deriveHdAccount: deriveHdAccountMock,
        useAccountsStore,
        useImportAccount: () => importAccountMock,
        useUpdateAccount: () => updateAccountMock,
    }
})

vi.mock('@perawallet/wallet-core-multisig', () => ({
    multisigChainAdapters: {
        get: () => ({ deriveAddress: deriveMultisigAddressMock }),
    },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    kmsCore: {},
    hexToBytes: (hex: string) =>
        Uint8Array.from(hex.match(/../g) ?? [], byte =>
            Number.parseInt(byte, 16),
        ),
    // Mirrors the real null-on-unknown-word contract, so the fixtures below
    // exercise both the happy path and the reject path.
    mnemonicWordsToIndices: (words: string[]) => {
        const indices = words.map(word => MOCK_WORDLIST.indexOf(word))
        return indices.includes(-1) ? null : new Uint16Array(indices)
    },
    zeroBytes: (...buffers: Array<Uint8Array | Uint16Array | null>) => {
        for (const buffer of buffers) buffer?.fill(0)
    },
    useKMS: () => ({
        keys: seedKeysState.value,
        hasSeedWithEntropy: hasSeedWithEntropyMock,
        persistHDMasterKey: persistHDMasterKeyMock,
    }),
}))

let idCounter = 0
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    generateOrderedUniqueId: () => `id-${idCounter++}`,
    logger: { warn: vi.fn() },
}))

// Imported after mocks are registered.
import {
    ChainAdapterNotRegisteredError,
    addressCodecs,
} from '@perawallet/wallet-core-chain-contract'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { useCloudBackupImport } from '../useCloudBackupImport'

// --- helpers ---------------------------------------------------------------

type HdCoordinates = { account: number; keyIndex: number }

/** acc0/idx0 is the seed's first-derived address, `FIRST`. */
const derivedAt = (
    seedKeyId: string,
    { account, keyIndex }: HdCoordinates,
    address = account === 0 && keyIndex === 0
        ? 'FIRST'
        : `ADDR-${account}-${keyIndex}`,
) => ({
    keyPairId: `${seedKeyId}-acc${account}-idx${keyIndex}-dt9`,
    publicKey: new Uint8Array([account, keyIndex]),
    address,
})

const appendedKeyPairIds = (): (string | undefined)[] =>
    (setAccountsMock.mock.calls.at(-1)?.[0] as { keyPairId?: string }[]).map(
        account => account.keyPairId,
    )

const renderImport = () => renderHook(() => useCloudBackupImport()).result

const A_HEX_96 = 'aa'.repeat(96)
const ENTROPY_HEX = 'bb'.repeat(32)

// Snapshot at call time: the hook zeroes the index buffer in its `finally`,
// so inspecting the stored mock arg would only ever see zeros.
let submittedIndices: number[] | null = null
const captureIndices = (args: { mnemonicIndices?: Uint16Array }) => {
    if (args.mnemonicIndices)
        submittedIndices = Array.from(args.mnemonicIndices)
}

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
    submittedIndices = null
    seedKeysState.value = new Map()
    hasSeedWithEntropyMock.mockReturnValue(false)
    findPathHolderMock.mockReturnValue(undefined)
    isValidAddressMock.mockReturnValue(true)
    addressCodecs.reset()
    addressCodecs.register({
        chainId: 'algorand',
        isValid: isValidAddressMock,
    } as never)
    addressCodecs.register({
        chainId: 'ethereum',
        isValid: isValidAddressMock,
    } as never)
    // The first-derived (acc0/idx0) child is the seed's own reference.
    seedReferenceMock.mockImplementation(async () => 'FIRST')
    deriveHdAccountMock.mockImplementation(
        async (
            _kms: unknown,
            seedKeyId: string,
            { account, keyIndex }: { account: number; keyIndex: number },
        ) => ({
            keyPairId: `derived-${seedKeyId}-${account}-${keyIndex}`,
            publicKey: new Uint8Array([account, keyIndex]),
            address:
                account === 0 && keyIndex === 0
                    ? 'FIRST'
                    : `ADDR-${account}-${keyIndex}`,
        }),
    )
    backupChainAdapters.reset()
    backupChainAdapters.register(
        fakeBackupAdapter({
            seedReference: seedReferenceMock,
            deriveHdAccount: deriveHdAccountMock,
        }),
    )
    // Default: each append to the store updates the live accounts list so
    // subsequent duplicate checks see prior writes.
    setAccountsMock.mockImplementation((next: { address: string }[]) => {
        storeState.accounts = next
    })
    importAccountMock.mockImplementation(
        async (args: { mnemonicIndices?: Uint16Array }) => {
            captureIndices(args)
            const account = { address: 'ALGO25_ADDR', type: 'algo25' }
            storeState.accounts = [...storeState.accounts, account]
            return account
        },
    )
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
                secretsPayload: {
                    type: 'algo25',
                    mnemonic: 'abandon ability able',
                    address: 'ALGO25_ADDR',
                },
            },
        ])

        expect(submittedIndices).toEqual([0, 1, 2])
        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonicIndices: expect.any(Uint16Array),
            type: 'standalone',
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
        importAccountMock.mockImplementation(
            async (args: { mnemonicIndices?: Uint16Array }) => {
                captureIndices(args)
                const accounts = [
                    { address: 'PQ_CANONICAL', type: 'quantum' },
                    { address: 'PQ_LEGACY', type: 'quantum' },
                ]
                storeState.accounts = [...storeState.accounts, ...accounts]
                return accounts
            },
        )
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'PQ_CANONICAL',
                addressPayload: {
                    type: 'quantum',
                    address: 'PQ_CANONICAL',
                    customName: 'My PQ',
                },
                secretsPayload: {
                    type: 'quantum',
                    mnemonic: 'about above absent',
                    address: 'PQ_CANONICAL',
                },
            },
        ])

        expect(submittedIndices).toEqual([3, 4, 5])
        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonicIndices: expect.any(Uint16Array),
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

    test('records a mnemonic that is not in the wordlist as failed', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'ALGO25_ADDR',
                addressPayload: {
                    type: 'algo25',
                    address: 'ALGO25_ADDR',
                    customName: null,
                },
                secretsPayload: {
                    type: 'algo25',
                    mnemonic: 'not a word',
                    address: 'ALGO25_ADDR',
                },
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
            expect.objectContaining({
                address: 'WATCH_ADDR',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'WATCH_ADDR' } },
            }),
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
                name: 'My Ledger',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'DE:AD:BE:EF',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 3,
                    transportType: 'ble',
                },
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'DE:AD:BE:EF',
                        deviceName: 'Ledger Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 3,
                },
                chains: { algorand: { address: 'LEDGER_ADDR' } },
            }),
        )
        expect(summary.imported).toBe(1)
    })

    test('rebuilds a multisig account from its participants', async () => {
        deriveMultisigAddressMock.mockReturnValue('MSIG_ADDR')
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

        const appended = setAccountsMock.mock.calls[0][0]
        expect(appended).toContainEqual(
            expect.objectContaining({
                address: 'MSIG_ADDR',
                multisigDetails: {
                    threshold: 2,
                    addresses: ['A', 'B'],
                    version: 1,
                },
                custody: { kind: 'multisig' },
                chains: {
                    algorand: {
                        address: 'MSIG_ADDR',
                        native: {
                            family: 'algorand',
                            multisig: {
                                version: 1,
                                threshold: 2,
                                addresses: ['A', 'B'],
                            },
                        },
                    },
                },
            }),
        )
        expect(summary.imported).toBe(1)
    })

    test('refuses a multisig account whose address does not re-derive', async () => {
        deriveMultisigAddressMock.mockReturnValue('SOMETHING_ELSE')
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
        isValidAddressMock.mockImplementation(
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

    test('reports progress per backup entry, counting duplicates and failures', async () => {
        storeState.accounts = [{ address: 'DUPE_ADDR' }]
        isValidAddressMock.mockImplementation(
            (addr?: string) => addr !== 'BAD_ADDR',
        )
        const onProgress = vi.fn()
        const { current } = renderImport()

        await current.importAccounts(
            [
                watchAccount('DUPE_ADDR'),
                watchAccount('BAD_ADDR'),
                watchAccount('GOOD_ADDR'),
            ],
            onProgress,
        )

        expect(onProgress.mock.calls).toEqual([
            [0, 3],
            [1, 3],
            [2, 3],
            [3, 3],
        ])
    })

    test('persists the hdSeed master key before deriving the hdWallet child', async () => {
        persistHDMasterKeyMock.mockImplementation(async () => {
            callOrder.push('persistHDMasterKey')
        })
        // `deriveHdAccount` both derives AND persists the child key, so the
        // importer no longer generates it separately. Track the derive calls to
        // assert the seed is persisted before the child derives.
        seedReferenceMock.mockResolvedValue('SEED_FIRST_DERIVED')
        deriveHdAccountMock.mockImplementation(async () => {
            callOrder.push('deriveHdAccount')
            return {
                keyPairId: 'derived-key-id',
                publicKey: new Uint8Array([1, 2, 3]),
                address: 'HD_KEY_ADDR',
            }
        })

        const { current } = renderImport()

        const summary = await current.importAccounts([
            // Provided hdWallet first: the seed pre-pass runs ahead of the
            // main loop, so input order can't starve the child of its parent.
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
                    address: 'SEED_ADDR',
                },
            },
        ])

        expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
        // The seed master key is persisted before the child is derived (the
        // last derive call corresponds to the child's own coords).
        expect(callOrder.indexOf('persistHDMasterKey')).toBeLessThan(
            callOrder.lastIndexOf('deriveHdAccount'),
        )
        // Only the hdWallet child surfaces as an imported account; the bare
        // seed does not.
        expect(summary.imported).toBe(1)
        expect(summary.failed).toEqual([])
        const appended = setAccountsMock.mock.calls.at(-1)?.[0]
        expect(appended).toContainEqual(
            expect.objectContaining({
                address: 'HD_KEY_ADDR',
                name: 'HD One',
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 1 },
                },
                chains: {
                    algorand: {
                        address: 'HD_KEY_ADDR',
                        keyPairId: expect.any(String),
                    },
                },
            }),
        )
    })

    test('persists the seed carried on the first hdWallet account, then imports all HD children', async () => {
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
                    address: 'FIRST',
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
                    address: 'FIRST',
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
        expect(deriveHdAccountMock).toHaveBeenCalledWith(
            expect.anything(),
            'held-seed',
            expect.objectContaining({ account: 0, keyIndex: 0 }),
        )
        expect(deriveHdAccountMock).toHaveBeenCalledWith(
            expect.anything(),
            'held-seed',
            expect.objectContaining({ account: 0, keyIndex: 1 }),
        )
        expect(summary.imported).toBe(2)
        expect(summary.failed).toEqual([])
    })

    test('imports the seed when the held seed derives to a different address', async () => {
        seedKeysState.value = new Map([['other-seed', {}]])
        hasSeedWithEntropyMock.mockReturnValue(true)
        // The held seed derives elsewhere; the restored one derives to FIRST.
        seedReferenceMock.mockImplementation(async (_kms, seed: string) =>
            seed === 'other-seed' ? 'OTHER' : 'FIRST',
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
                    address: 'FIRST',
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
                    address: 'SEED_ADDR',
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
                    address: 'FIRST',
                },
            },
        ])
        const firstFailures = summary.failed.filter(f => f.address === 'FIRST')
        expect(firstFailures).toHaveLength(1)
        expect(summary.imported).toBe(0)
    })

    test('with no backup adapter registered, rejects before any keystore or store write', async () => {
        backupChainAdapters.reset()
        const { current } = renderImport()

        await expect(
            current.importAccounts([watchAccount('WATCH_ADDR')]),
        ).rejects.toThrow(ChainAdapterNotRegisteredError)

        expect(persistHDMasterKeyMock).not.toHaveBeenCalled()
        expect(importAccountMock).not.toHaveBeenCalled()
        expect(setAccountsMock).not.toHaveBeenCalled()
    })
})

describe('useCloudBackupImport on another chain', () => {
    const FIXTURE_KEY_HEX =
        '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'

    const hdSeedEntry = (): PulledAccount => ({
        address: 'FIRST',
        addressPayload: { type: 'hdSeed', address: 'FIRST' },
        secretsPayload: {
            type: 'hdSeed',
            seed: A_HEX_96,
            entropy: ENTROPY_HEX,
            address: 'FIRST',
        },
    })

    const hdChainEntry = (
        address = '0xeth',
        keyIndex = 1,
        customName: string | null = 'Eth One',
    ): PulledAccount => ({
        address,
        addressPayload: {
            type: 'hdChain',
            chain: 'ethereum',
            address,
            seedFirstDerivedAddress: 'FIRST',
            account: 0,
            keyIndex,
            customName,
        },
        secretsPayload: null,
    })

    const hdWalletEntry = (): PulledAccount => ({
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
            customName: 'Algo One',
        },
        secretsPayload: null,
    })

    const standaloneKeyEntry = (
        secret: Partial<{ chain: string; privateKey: string }> | null = {},
    ): PulledAccount =>
        ({
            address: '0xkey',
            addressPayload: {
                type: 'standaloneKey',
                chain: 'ethereum',
                address: '0xkey',
                customName: 'Imported',
            },
            secretsPayload:
                secret === null
                    ? null
                    : {
                          type: 'standaloneKey',
                          chain: 'ethereum',
                          address: '0xkey',
                          privateKey: FIXTURE_KEY_HEX,
                          ...secret,
                      },
        }) as PulledAccount

    /** What the store does: add the chain entry to the account, or create one. */
    const storeCreatesAccountAt = (address: string) =>
        addChainAccountMock.mockImplementation(async () => {
            const account = {
                id: `acc-${address}`,
                address,
                chains: { ethereum: { address } },
            }
            storeState.accounts = [...storeState.accounts, account]
            return account
        })

    beforeEach(() => {
        persistHDMasterKeyMock.mockReset()
        addChainAccountMock.mockReset()
        importAccountFromPrivateKeyMock.mockReset()
        storeCreatesAccountAt('0xeth')
    })

    describe('hdChain', () => {
        test('derives the account through the store at the stored position, against the seed the batch carried', async () => {
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
            expect(addChainAccountMock).toHaveBeenCalledWith(
                'id-0',
                'ethereum',
                { account: 0, keyIndex: 1 },
                'Eth One',
            )
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('counts nothing when the call only added the chain to an account already held', async () => {
            const existing = { id: 'held', address: 'ALGO', chains: {} }
            storeState.accounts = [existing]
            addChainAccountMock.mockImplementation(async () => ({
                ...existing,
                chains: { ethereum: { address: '0xeth' } },
            }))
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(summary).toMatchObject({ imported: 0, failed: [] })
        })

        test('derives against a seed the device already holds when the batch has no seed', async () => {
            seedKeysState.value = new Map([['held-seed', {}]])
            hasSeedWithEntropyMock.mockReturnValue(true)
            const { current } = renderImport()

            const summary = await current.importAccounts([hdChainEntry()])

            expect(persistHDMasterKeyMock).not.toHaveBeenCalled()
            expect(addChainAccountMock).toHaveBeenCalledWith(
                'held-seed',
                'ethereum',
                { account: 0, keyIndex: 1 },
                'Eth One',
            )
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('derives an hdWallet item that arrives alone against the held seed too', async () => {
            seedKeysState.value = new Map([['held-seed', {}]])
            hasSeedWithEntropyMock.mockReturnValue(true)
            const { current } = renderImport()

            const summary = await current.importAccounts([hdWalletEntry()])

            expect(persistHDMasterKeyMock).not.toHaveBeenCalled()
            expect(deriveHdAccountMock).toHaveBeenCalledWith(
                expect.anything(),
                'held-seed',
                expect.objectContaining({ account: 0, keyIndex: 1 }),
            )
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('persists no second copy of the seed when the same backup is restored twice', async () => {
            const { current } = renderImport()
            await current.importAccounts([hdSeedEntry(), hdChainEntry()])
            seedKeysState.value = new Map([['id-0', {}]])
            hasSeedWithEntropyMock.mockReturnValue(true)
            storeState.accounts = []

            // A fresh render, as a later sync would have: it reads the keystore again.
            await renderImport().current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(persistHDMasterKeyMock).toHaveBeenCalledTimes(1)
            expect(addChainAccountMock).toHaveBeenLastCalledWith(
                'id-0',
                'ethereum',
                expect.anything(),
                expect.anything(),
            )
        })

        test('runs after the hdWallet item of its account, whatever order they were pulled in', async () => {
            deriveHdAccountMock.mockImplementation(async () => {
                callOrder.push('hdWallet')
                return {
                    keyPairId: 'k',
                    publicKey: new Uint8Array([1]),
                    address: 'ADDR-0-1',
                }
            })
            addChainAccountMock.mockImplementation(async () => {
                callOrder.push('hdChain')
                return { id: 'a', chains: { ethereum: { address: '0xeth' } } }
            })
            const { current } = renderImport()

            await current.importAccounts([
                hdChainEntry(),
                hdWalletEntry(),
                hdSeedEntry(),
            ])

            expect(callOrder).toEqual(['hdWallet', 'hdChain'])
        })

        test('merges an hdWallet item into the Ethereum-only account at its position', async () => {
            const holder = {
                id: 'eth-first',
                address: '0xeth',
                chains: { ethereum: { address: '0xeth' } },
            }
            storeState.accounts = [holder]
            findPathHolderMock.mockReturnValue(holder)
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdWalletEntry(),
            ])

            const stored = setAccountsMock.mock.calls.at(-1)?.[0]
            expect(stored).toHaveLength(1)
            expect(stored[0]).toMatchObject({
                id: 'eth-first',
                chains: {
                    ethereum: { address: '0xeth' },
                    algorand: { address: 'ADDR-0-1' },
                },
            })
            expect(findPathHolderMock).toHaveBeenCalledWith(
                expect.anything(),
                'id-0',
                { account: 0, keyIndex: 1 },
            )
            expect(summary.failed).toEqual([])
        })

        test('lands a held-seed wallet with no account of it as failed with the address, without aborting the batch', async () => {
            seedKeysState.value = new Map([['held-seed', {}]])
            hasSeedWithEntropyMock.mockReturnValue(true)
            addChainAccountMock.mockRejectedValueOnce(
                new Error('cannot derive'),
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdChainEntry('0xfirst', 0),
                watchChainEntry('0xwatch'),
            ])

            expect(summary.failed).toEqual([
                { address: '0xfirst', reason: 'cannot derive' },
            ])
            expect(summary.imported).toBe(1)
        })

        test('fails an item whose derived address differs from the backup', async () => {
            storeCreatesAccountAt('0xsomething-else')
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(summary.imported).toBe(0)
            expect(summary.failed).toEqual([
                {
                    address: '0xeth',
                    reason: expect.stringContaining('address mismatch'),
                },
            ])
        })

        test('counts a DuplicateAccountError from the store as skipped', async () => {
            addChainAccountMock.mockRejectedValue(
                new DuplicateAccountError('0xeth'),
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(summary).toMatchObject({
                imported: 0,
                skippedDuplicate: 1,
                failed: [],
            })
        })
    })

    describe('standaloneKey', () => {
        const importedKey = () => ({
            id: 'imp',
            address: '0xkey',
            chains: { ethereum: { address: '0xkey' } },
        })

        test('hands the store the decoded key and zeroes those bytes afterwards', async () => {
            let handedOver: Uint8Array | undefined
            let atCall: number[] = []
            importAccountFromPrivateKeyMock.mockImplementation(
                async (_chain: string, bytes: Uint8Array) => {
                    handedOver = bytes
                    atCall = Array.from(bytes)
                    return importedKey()
                },
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(importAccountFromPrivateKeyMock).toHaveBeenCalledWith(
                'ethereum',
                expect.any(Uint8Array),
                'Imported',
            )
            expect(atCall).toEqual(
                Array.from({ length: 32 }, (_, index) => index + 1),
            )
            expect(handedOver?.every(byte => byte === 0)).toBe(true)
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('zeroes the bytes when the store throws', async () => {
            let handedOver: Uint8Array | undefined
            importAccountFromPrivateKeyMock.mockImplementation(
                async (_chain: string, bytes: Uint8Array) => {
                    handedOver = bytes
                    throw new Error('keystore refused')
                },
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(handedOver?.every(byte => byte === 0)).toBe(true)
            expect(summary.failed).toEqual([
                { address: '0xkey', reason: 'keystore refused' },
            ])
        })

        test.each([
            ['has no secret', null],
            ['has a secret on another chain', { chain: 'algorand' }],
        ])(
            'fails an account that %s without calling the store',
            async (_label, secret) => {
                const { current } = renderImport()

                const summary = await current.importAccounts([
                    standaloneKeyEntry(secret),
                ])

                expect(importAccountFromPrivateKeyMock).not.toHaveBeenCalled()
                expect(summary.failed).toHaveLength(1)
                expect(summary.imported).toBe(0)
            },
        )

        test('fails an account whose key derives another address', async () => {
            importAccountFromPrivateKeyMock.mockResolvedValue({
                id: 'imp',
                chains: { ethereum: { address: '0xother' } },
            })
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(summary.failed).toEqual([
                {
                    address: '0xkey',
                    reason: expect.stringContaining('address mismatch'),
                },
            ])
        })

        test('counts a DuplicateAccountError from the store as skipped', async () => {
            importAccountFromPrivateKeyMock.mockRejectedValue(
                new DuplicateAccountError('0xkey'),
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(summary).toMatchObject({
                imported: 0,
                skippedDuplicate: 1,
                failed: [],
            })
        })
    })

    describe('watchChain', () => {
        test('builds the account on its own chain', async () => {
            const { current } = renderImport()

            const summary = await current.importAccounts([
                watchChainEntry('0xwatch'),
            ])

            expect(setAccountsMock.mock.calls.at(-1)?.[0]).toEqual([
                expect.objectContaining({
                    address: '0xwatch',
                    name: 'Eth watch',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xwatch' } },
                }),
            ])
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('validates the address against its own chain codec', async () => {
            isValidAddressMock.mockImplementation(
                (address?: string) => address !== '0xbad',
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([
                watchChainEntry('0xbad'),
            ])

            expect(summary.failed).toEqual([
                {
                    address: '0xbad',
                    reason: 'Invalid ethereum address: 0xbad',
                },
            ])
        })

        test('skips an address already held as a non-primary chain entry of another account', async () => {
            storeState.accounts = [
                {
                    id: 'held',
                    address: 'ALGO',
                    chains: {
                        algorand: { address: 'ALGO' },
                        ethereum: { address: '0xwatch' },
                    },
                } as never,
            ]
            const { current } = renderImport()

            const summary = await current.importAccounts([
                watchChainEntry('0xwatch'),
            ])

            expect(summary).toMatchObject({
                imported: 0,
                skippedDuplicate: 1,
            })
            expect(setAccountsMock).not.toHaveBeenCalled()
        })
    })
})

function watchChainEntry(address: string): PulledAccount {
    return {
        address,
        addressPayload: {
            type: 'watchChain',
            chain: 'ethereum',
            address,
            customName: 'Eth watch',
        },
        secretsPayload: null,
    }
}
