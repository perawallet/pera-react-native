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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// --- hoisted mock state + spies -------------------------------------------

const {
    storeState,
    setAccountsMock,
    importAccountMock,
    importScopes,
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
        storeState: { accounts: [] as WalletAccount[] },
        setAccountsMock: vi.fn(),
        importAccountMock: vi.fn(),
        importScopes: [] as unknown[],
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
    const useAccountsStore = (selector?: (s: unknown) => unknown) => {
        const state = {
            accounts: storeState.accounts,
            setAccounts: setAccountsMock,
        }
        return selector ? selector(state) : state
    }
    useAccountsStore.getState = () => ({ accounts: storeState.accounts })

    return {
        buildAccount,
        DuplicateAccountError,
        // Stands in for the chain's record encoding of the parameters.
        withMultisigParameters: (
            account: WalletAccount,
            chainId: 'algorand',
            parameters: unknown,
        ) => ({
            ...account,
            chains: {
                ...account.chains,
                [chainId]: {
                    ...account.chains[chainId],
                    native: { family: 'algorand', multisig: parameters },
                },
            },
        }),
        findAddressHolder: (
            accounts: WalletAccount[],
            scope: { chainId: string },
            address: string,
        ) =>
            accounts.find(
                account =>
                    account.chains[scope.chainId as 'algorand']?.address ===
                    address,
            ),
        useAccountsStore,
        useImportAccount: (scope: unknown) => {
            importScopes.push(scope)
            return importAccountMock
        },
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
    hexToBytes: (hex: string) => new Uint8Array(hex.length / 2),
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
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Imported after mocks are registered.
import {
    ChainAdapterNotRegisteredError,
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { backupChainAdapters } from '../../../chain-adapter'
import {
    FakeBackupKinds,
    fakeBackupAdapter,
} from '../../../__tests__/fakeBackupAdapter'
import { useCloudBackupImport } from '../useCloudBackupImport'
import { chainBackupKind } from '../../models'
import { UnsupportedBackupAccountTypeError } from '../../sync/types'

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
    (setAccountsMock.mock.calls.at(-1)?.[0] as WalletAccount[]).map(
        account => account.chains.algorand?.keyPairId,
    )

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const renderImport = () => renderHook(() => useCloudBackupImport(SCOPE)).result

const A_HEX_96 = 'aa'.repeat(96)
const ENTROPY_HEX = 'bb'.repeat(32)

// Snapshot at call time: the hook zeroes the index buffer in its `finally`,
// so inspecting the stored mock arg would only ever see zeros.
let submittedIndices: number[] | null = null
const captureIndices = (args: { mnemonicIndices?: Uint16Array }) => {
    if (args.mnemonicIndices)
        submittedIndices = Array.from(args.mnemonicIndices)
}

/** An account the wallet already holds; its id is its address. */
const held = (
    address: string,
    custody: WalletAccount['custody'] = { kind: 'watch' },
): WalletAccount => ({
    id: address,
    custody,
    chains: {
        algorand: {
            address,
            ...(custody.kind === 'local'
                ? { keyPairId: `key-${address}` }
                : {}),
        },
    },
})

const watchAccount = (address: string): PulledAccount => ({
    address,
    addressPayload: { type: 'watch', address, customName: null },
    secretsPayload: null,
})

beforeEach(() => {
    vi.clearAllMocks()
    importScopes.length = 0
    storeState.accounts = []
    idCounter = 0
    callOrder.length = 0
    submittedIndices = null
    seedKeysState.value = new Map()
    hasSeedWithEntropyMock.mockReturnValue(false)
    isValidAddressMock.mockReturnValue(true)
    addressCodecs.reset()
    addressCodecs.register({
        chainId: 'algorand',
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
    setAccountsMock.mockImplementation((next: WalletAccount[]) => {
        storeState.accounts = next
    })
    importAccountMock.mockImplementation(
        async (args: { mnemonicIndices?: Uint16Array }) => {
            captureIndices(args)
            const account = held('ALGO25_ADDR', {
                kind: 'local',
                seed: null,
            })
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
                    type: FakeBackupKinds.standalone,
                    address: 'ALGO25_ADDR',
                    customName: 'My Algo25',
                },
                secretsPayload: {
                    type: FakeBackupKinds.standalone,
                    mnemonic: 'abandon ability able',
                    address: 'ALGO25_ADDR',
                },
            },
        ])

        expect(importScopes.at(-1)).toEqual(SCOPE)
        expect(submittedIndices).toEqual([0, 1, 2])
        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonicIndices: expect.any(Uint16Array),
            seed: null,
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
                    held('PQ_CANONICAL', { kind: 'local', seed: 'quantum' }),
                    held('PQ_LEGACY', { kind: 'local', seed: 'quantum' }),
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
                    type: FakeBackupKinds.quantum,
                    address: 'PQ_CANONICAL',
                    customName: 'My PQ',
                },
                secretsPayload: {
                    type: FakeBackupKinds.quantum,
                    mnemonic: 'about above absent',
                    address: 'PQ_CANONICAL',
                },
            },
        ])

        expect(submittedIndices).toEqual([3, 4, 5])
        expect(importAccountMock).toHaveBeenCalledWith({
            mnemonicIndices: expect.any(Uint16Array),
            seed: 'quantum',
        })
        // The name belongs to the backed-up address, not to the sibling
        // derivation the probe happened to adopt alongside it.
        expect(updateAccountMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'PQ_CANONICAL', name: 'My PQ' }),
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
                    type: FakeBackupKinds.standalone,
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
                    type: FakeBackupKinds.standalone,
                    address: 'ALGO25_ADDR',
                    customName: null,
                },
                secretsPayload: {
                    type: FakeBackupKinds.standalone,
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
                name: 'My Ledger',
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
        storeState.accounts = [held('WATCH_ADDR')]
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
                    (a: WalletAccount) =>
                        a.chains.algorand?.address === 'GOOD_ADDR',
                ),
            ),
        ).toBe(true)
    })

    test("records an item of a kind the chain's adapter doesn't decode as that item's typed failure, importing the rest", async () => {
        const unknownKind = chainBackupKind('fixtureChainAccount')
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'FIX_ADDR',
                addressPayload: {
                    type: unknownKind,
                    address: 'FIX_ADDR',
                    customName: null,
                },
                secretsPayload: {
                    type: unknownKind,
                    mnemonic: 'abandon ability able',
                    address: 'FIX_ADDR',
                },
            },
            watchAccount('GOOD_ADDR'),
        ])

        expect(summary.imported).toBe(1)
        expect(summary.failed).toEqual([
            {
                address: 'FIX_ADDR',
                reason: new UnsupportedBackupAccountTypeError(
                    'fixtureChainAccount',
                    'algorand',
                ).message,
            },
        ])
        expect(importAccountMock).not.toHaveBeenCalled()
    })

    test('refuses an item naming a parent seed for a kind the adapter decodes as a single key', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'ALGO25_ADDR',
                addressPayload: {
                    type: FakeBackupKinds.standalone,
                    address: 'ALGO25_ADDR',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: '00',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: null,
                },
                secretsPayload: {
                    type: FakeBackupKinds.standalone,
                    mnemonic: 'abandon ability able',
                    address: 'ALGO25_ADDR',
                },
            },
        ])

        expect(summary.imported).toBe(0)
        expect(summary.failed).toHaveLength(1)
        expect(importAccountMock).not.toHaveBeenCalled()
    })

    test('never derives an HD-shaped item whose kind the adapter does not decode', async () => {
        const unknownKind = chainBackupKind('fixtureHdAccount')
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'FIRST',
                addressPayload: {
                    type: unknownKind,
                    address: 'FIRST',
                    seedFirstDerivedAddress: 'FIRST',
                    publicKey: '00',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                    customName: null,
                },
                secretsPayload: null,
            },
        ])

        expect(summary.imported).toBe(0)
        expect(summary.failed).toEqual([
            {
                address: 'FIRST',
                reason: new UnsupportedBackupAccountTypeError(
                    'fixtureHdAccount',
                    'algorand',
                ).message,
            },
        ])
        expect(deriveHdAccountMock).not.toHaveBeenCalled()
        expect(setAccountsMock).not.toHaveBeenCalled()
    })

    test('reports progress per backup entry, counting duplicates and failures', async () => {
        storeState.accounts = [held('DUPE_ADDR')]
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
                    type: FakeBackupKinds.hdAccount,
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
