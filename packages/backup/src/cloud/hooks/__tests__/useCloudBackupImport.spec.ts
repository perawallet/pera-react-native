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
    addChainAccountMock,
    importAccountFromPrivateKeyMock,
    discoverChainsMock,
    enableChainMock,
    findPathHolderMock,
    setAccountsMock,
    importAccountMock,
    importScopes,
    updateAccountMock,
    persistHDMasterKeyMock,
    seedKeysState,
    hasSeedWithEntropyMock,
    seedReferenceMock,
    deriveHdAccountMock,
    deriveClaimedHdKeyMock,
    deriveMultisigAddressMock,
    isValidAddressMock,
    callOrder,
    markBackedUpMock,
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
        addChainAccountMock: vi.fn(),
        importAccountFromPrivateKeyMock: vi.fn(),
        discoverChainsMock: vi.fn(async () => []),
        enableChainMock: vi.fn(),
        findPathHolderMock: vi.fn(),
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
        deriveClaimedHdKeyMock: vi.fn(
            (
                _chainId: string,
                _seedKeyId: string,
                _index: unknown,
                derive: () => Promise<unknown>,
            ) => derive(),
        ),
        deriveMultisigAddressMock: vi.fn(),
        isValidAddressMock: vi.fn((_address?: string) => true),
        callOrder: [] as string[],
        markBackedUpMock: vi.fn(),
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
    const { buildAccount, withEnablement } = await vi.importActual<
        Pick<
            typeof import('@perawallet/wallet-core-accounts'),
            'buildAccount' | 'withEnablement'
        >
    >('@perawallet/wallet-core-accounts/build-account')
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
        discoverChains: discoverChainsMock,
        enableChain: enableChainMock,
    })

    return {
        buildAccount,
        withEnablement,
        deriveClaimedHdKey: deriveClaimedHdKeyMock,
        chainAccountOf: (account: WalletAccount, chainId: string) =>
            account.chains[chainId as 'algorand'],
        hasCustody: (account: WalletAccount, kind: string) =>
            account.custody.kind === kind,
        findPathHolder: findPathHolderMock,
        isSameAddress: (_chainId: string, a: string, b: string) => a === b,
        DuplicateAccountError,
        AddressMismatchError: class AddressMismatchError extends Error {},
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

vi.mock('../../../mnemonic/hooks', () => ({
    useMarkMnemonicBackupComplete: () => markBackedUpMock,
}))

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

/** What every builder records on an entry from a record written before enablement was. */
const CREATED = { enabledAt: expect.any(Number), enabledBy: 'created' }

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
    group: address,
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
                group: 'ALGO25_ADDR',
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
                group: 'PQ_CANONICAL',
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
                group: 'ALGO25_ADDR',
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
                group: 'ALGO25_ADDR',
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
                chains: {
                    algorand: { address: 'WATCH_ADDR', ...CREATED },
                },
            }),
        )
        expect(summary.imported).toBe(1)
    })

    test('rebuilds a hardware account from its device metadata', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                address: 'LEDGER_ADDR',
                group: 'LEDGER_ADDR',
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
                chains: { algorand: { address: 'LEDGER_ADDR', ...CREATED } },
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
                group: 'MSIG_ADDR',
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
                        ...CREATED,
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
                group: 'MSIG_ADDR',
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

    test('renames an already-present account to the name the backup carries', async () => {
        storeState.accounts = [{ ...held('WATCH_ADDR'), name: 'Old' }]
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                ...watchAccount('WATCH_ADDR'),
                chain: 'algorand',
                addressPayload: {
                    type: 'watch',
                    address: 'WATCH_ADDR',
                    customName: 'New',
                },
            },
        ])

        expect(summary.skippedDuplicate).toBe(1)
        expect(storeState.accounts[0].name).toBe('New')
    })

    test("clears an already-present account's name when its record has none", async () => {
        storeState.accounts = [{ ...held('WATCH_ADDR'), name: 'Old' }]
        const { current } = renderImport()

        await current.importAccounts([
            { ...watchAccount('WATCH_ADDR'), chain: 'algorand' },
        ])

        expect(storeState.accounts[0]).not.toHaveProperty('name')
    })

    test('keeps the name of an already-present account a nameless legacy item names', async () => {
        storeState.accounts = [{ ...held('WATCH_ADDR'), name: 'Old' }]
        const { current } = renderImport()

        await current.importAccounts([watchAccount('WATCH_ADDR')])

        expect(setAccountsMock).not.toHaveBeenCalled()
        expect(storeState.accounts[0].name).toBe('Old')
    })

    test('marks every account the batch creates as backed up, and none already held', async () => {
        storeState.accounts = [held('HELD_ADDR')]
        const { current } = renderImport()

        await current.importAccounts([
            watchAccount('HELD_ADDR'),
            watchAccount('NEW_ADDR'),
        ])

        expect(markBackedUpMock).toHaveBeenCalledTimes(1)
        expect(markBackedUpMock).toHaveBeenCalledWith(
            expect.objectContaining({
                chains: { algorand: { address: 'NEW_ADDR', ...CREATED } },
            }),
        )
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

    test('reports progress per account, counting duplicates and failures', async () => {
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
                group: 'HD_KEY_ADDR',
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
                group: 'SEED_ADDR',
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
                        ...CREATED,
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
                group: 'FIRST',
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
                group: 'ADDR-0-1',
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
        // Claimed, so a discovery walk on the same seed can't drop a child
        // before its account is stored.
        expect(
            deriveClaimedHdKeyMock.mock.calls.map(([, , index]) => index),
        ).toEqual([
            { account: 0, keyIndex: 0 },
            { account: 0, keyIndex: 1 },
        ])
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
                group: 'FIRST',
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
                group: 'ADDR-0-1',
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
                group: 'FIRST',
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
                group: 'SEED_ADDR',
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
                group: 'FIRST',
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

describe('useCloudBackupImport on another chain', () => {
    const FIXTURE_KEY_HEX =
        '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'

    const hdSeedEntry = (): PulledAccount => ({
        address: 'FIRST',
        group: 'FIRST',
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
        group: `FIRST/0/${keyIndex}`,
        chain: 'ethereum',
        addressPayload: {
            type: 'hdChain',
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
        group: 'FIRST/0/1',
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
            group: '0xkey',
            chain: 'ethereum',
            addressPayload: {
                type: 'standaloneKey',
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
                '0xeth',
                'created',
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
                '0xeth',
                'created',
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
                expect.anything(),
                'created',
            )
        })

        test('imports the chains of an account in the order its record lists them', async () => {
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

            expect(callOrder).toEqual(['hdChain', 'hdWallet'])
        })

        test('reports progress per wallet account, not per chain entry or seed', async () => {
            const onProgress = vi.fn()
            const { current } = renderImport()

            await current.importAccounts(
                [
                    hdChainEntry(),
                    hdSeedEntry(),
                    watchChainEntry('0xwatch'),
                    hdWalletEntry(),
                ],
                onProgress,
            )

            expect(onProgress.mock.calls).toEqual([
                [0, 2],
                [1, 2],
                [2, 2],
            ])
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

        test('fails an item the store refuses for deriving another address', async () => {
            addChainAccountMock.mockRejectedValue(
                new Error(
                    'Derived address 0xother does not match expected 0xeth',
                ),
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([
                hdSeedEntry(),
                hdChainEntry(),
            ])

            expect(summary.imported).toBe(0)
            expect(summary.failed).toEqual([
                {
                    address: '0xeth',
                    reason: expect.stringContaining('does not match'),
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
                    storeState.accounts = [importedKey() as never]
                    return importedKey()
                },
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(importAccountFromPrivateKeyMock).toHaveBeenCalledWith(
                'ethereum',
                expect.any(Uint8Array),
                'Imported',
                '0xkey',
                { enabledBy: 'created', shouldDiscover: false },
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

        test("restores every chain of a key from the account's one secret, as one account", async () => {
            const keyAccount = {
                ...importedKey(),
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xkey', keyPairId: 'raw' } },
            }
            importAccountFromPrivateKeyMock.mockImplementation(async () => {
                storeState.accounts = [keyAccount as never]
                return keyAccount
            })
            enableChainMock.mockImplementation(
                async (_id: string, chain: string) => {
                    const joined = {
                        ...keyAccount,
                        chains: {
                            ...keyAccount.chains,
                            [chain]: { address: '0xkey', keyPairId: 'raw' },
                        },
                    }
                    storeState.accounts = [joined as never]
                    return joined
                },
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([
                standaloneKeyEntry(),
                { ...standaloneKeyEntry(), chain: 'base' } as PulledAccount,
            ])

            expect(importAccountFromPrivateKeyMock).toHaveBeenCalledOnce()
            expect(enableChainMock).toHaveBeenCalledExactlyOnceWith(
                'imp',
                'base',
                'created',
                { expectedAddress: '0xkey' },
            )
            expect(storeState.accounts).toHaveLength(1)
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test("fails a later chain the store refuses for an address that isn't the key's", async () => {
            const keyAccount = {
                ...importedKey(),
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xkey', keyPairId: 'raw' } },
            }
            importAccountFromPrivateKeyMock.mockImplementation(async () => {
                storeState.accounts = [keyAccount as never]
                return keyAccount
            })
            enableChainMock.mockRejectedValue(new Error('address mismatch'))
            const { current } = renderImport()

            const summary = await current.importAccounts([
                standaloneKeyEntry(),
                { ...standaloneKeyEntry(), chain: 'base' } as PulledAccount,
            ])

            expect(enableChainMock).toHaveBeenCalledWith(
                'imp',
                'base',
                'created',
                { expectedAddress: '0xkey' },
            )
            expect(summary.failed).toEqual([
                { address: '0xkey', reason: 'address mismatch' },
            ])
        })

        test('fails an account that has no secret without calling the store', async () => {
            const { current } = renderImport()

            const summary = await current.importAccounts([
                standaloneKeyEntry(null),
            ])

            expect(importAccountFromPrivateKeyMock).not.toHaveBeenCalled()
            expect(summary.failed).toHaveLength(1)
            expect(summary.imported).toBe(0)
        })

        test('fails an account the store refuses for deriving another address', async () => {
            importAccountFromPrivateKeyMock.mockRejectedValue(
                new Error(
                    'Derived address 0xother does not match expected 0xkey',
                ),
            )
            const { current } = renderImport()

            const summary = await current.importAccounts([standaloneKeyEntry()])

            expect(summary.failed).toEqual([
                {
                    address: '0xkey',
                    reason: expect.stringContaining('does not match'),
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

    describe('watch on another chain', () => {
        test('joins the other chain of a watch account to the account its first chain created', async () => {
            const { current } = renderImport()

            const summary = await current.importAccounts([
                { ...watchAccount('WALGO'), group: 'WALGO' },
                { ...watchChainEntry('0xwatch'), group: 'WALGO' },
            ])

            expect(storeState.accounts).toEqual([
                expect.objectContaining({
                    chains: {
                        algorand: { address: 'WALGO', ...CREATED },
                        ethereum: { address: '0xwatch', ...CREATED },
                    },
                }),
            ])
            expect(summary).toMatchObject({ imported: 1, failed: [] })
        })

        test('keeps a chain the account already holds at another address, importing the entry as its own account', async () => {
            const held = {
                id: 'held',
                address: 'WALGO',
                custody: { kind: 'watch' },
                chains: {
                    algorand: { address: 'WALGO' },
                    ethereum: { address: '0xold' },
                },
            }
            storeState.accounts = [held as never]
            const { current } = renderImport()

            await current.importAccounts([
                { ...watchAccount('WALGO'), group: 'WALGO' },
                { ...watchChainEntry('0xwatch'), group: 'WALGO' },
            ])

            expect(storeState.accounts).toEqual([
                held,
                expect.objectContaining({
                    chains: { ethereum: { address: '0xwatch', ...CREATED } },
                }),
            ])
        })

        test('builds the account on its own chain', async () => {
            const { current } = renderImport()

            const summary = await current.importAccounts([
                watchChainEntry('0xwatch'),
            ])

            expect(setAccountsMock.mock.calls.at(-1)?.[0]).toEqual([
                expect.objectContaining({
                    name: 'Eth watch',
                    custody: { kind: 'watch' },
                    chains: { ethereum: { address: '0xwatch', ...CREATED } },
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
            expect(storeState.accounts).toHaveLength(1)
        })
    })
})

describe('useCloudBackupImport hardware on several chains', () => {
    beforeEach(() => {
        storeState.accounts = []
        setAccountsMock.mockImplementation((next: WalletAccount[]) => {
            storeState.accounts = next
        })
    })

    test('restores a hardware account on two chains as one account with both entries', async () => {
        const { current } = renderImport()

        const summary = await current.importAccounts([
            {
                ...hardwareEntry('LEDGER_ALGO', 'algorand'),
                group: 'LEDGER_ALGO',
            },
            { ...hardwareEntry('0xledger', 'ethereum'), group: 'LEDGER_ALGO' },
        ])

        expect(storeState.accounts).toEqual([
            expect.objectContaining({
                custody: expect.objectContaining({ kind: 'hardware' }),
                chains: {
                    algorand: { address: 'LEDGER_ALGO', ...CREATED },
                    ethereum: { address: '0xledger', ...CREATED },
                },
            }),
        ])
        expect(summary).toMatchObject({ imported: 1, failed: [] })
    })

    test.each([
        ['after', ['ethereum', 'algorand']],
        ['before', ['algorand', 'ethereum']],
        ['around', ['ethereum', 'base', 'algorand']],
    ] as const)(
        "joins a record's entries to the account holding another of its addresses, listed %s it, keeping the backup's name",
        async (_order, chains) => {
            addressCodecs.register({
                chainId: 'base',
                isValid: isValidAddressMock,
            } as never)
            const existing: WalletAccount = {
                id: 'existing',
                custody: {
                    kind: 'hardware',
                    device: LEDGER_DEVICE,
                    accountIndex: 0,
                },
                chains: { algorand: { address: 'LEDGER_ALGO' } },
            }
            storeState.accounts = [existing]
            const addressOn = {
                algorand: 'LEDGER_ALGO',
                ethereum: '0xledger',
                base: '0xledger',
            }
            const { current } = renderImport()

            const summary = await current.importAccounts(
                chains.map(chain => ({
                    ...hardwareEntry(addressOn[chain], chain),
                    group: 'record',
                })),
            )

            expect(storeState.accounts).toEqual([
                {
                    ...existing,
                    name: 'My Ledger',
                    chains: Object.fromEntries(
                        chains.map(chain => [
                            chain,
                            chain === 'algorand'
                                ? { address: 'LEDGER_ALGO' }
                                : { address: addressOn[chain], ...CREATED },
                        ]),
                    ),
                },
            ])
            expect(summary).toMatchObject({
                imported: 0,
                skippedDuplicate: 1,
                failed: [],
            })
        },
    )

    test('restores an entry sharing no address with the account at its device position as its own account', async () => {
        const existing: WalletAccount = {
            id: 'existing',
            custody: {
                kind: 'hardware',
                device: LEDGER_DEVICE,
                accountIndex: 0,
            },
            chains: { algorand: { address: 'LEDGER_ALGO' } },
        }
        storeState.accounts = [existing]
        const { current } = renderImport()

        const summary = await current.importAccounts([
            hardwareEntry('0xledger', 'ethereum'),
        ])

        expect(storeState.accounts).toEqual([
            existing,
            expect.objectContaining({
                custody: expect.objectContaining({
                    kind: 'hardware',
                    accountIndex: 0,
                }),
                chains: { ethereum: { address: '0xledger', ...CREATED } },
            }),
        ])
        expect(summary).toMatchObject({ imported: 1, failed: [] })
    })

    test('restores another seed at a held position as its own account', async () => {
        storeState.accounts = [
            {
                id: 'existing',
                custody: {
                    kind: 'hardware',
                    device: LEDGER_DEVICE,
                    accountIndex: 0,
                },
                chains: { ethereum: { address: '0xother' } },
            },
        ]
        const { current } = renderImport()

        await current.importAccounts([hardwareEntry('0xledger', 'ethereum')])

        expect(storeState.accounts).toHaveLength(2)
        expect(storeState.accounts[0].chains).toEqual({
            ethereum: { address: '0xother' },
        })
    })

    test('restores a USB entry as its own account, whose id names a model', async () => {
        storeState.accounts = [
            {
                id: 'existing',
                custody: {
                    kind: 'hardware',
                    device: { ...LEDGER_DEVICE, transportType: 'usb' },
                    accountIndex: 0,
                },
                chains: { algorand: { address: 'LEDGER_ALGO' } },
            },
        ]
        const entry = hardwareEntry('0xledger', 'ethereum')
        const { current } = renderImport()

        await current.importAccounts([
            {
                ...entry,
                addressPayload: {
                    ...entry.addressPayload,
                    transportType: 'usb',
                } as typeof entry.addressPayload,
            },
        ])

        expect(storeState.accounts).toHaveLength(2)
    })

    test('keeps another account index of the device as its own account', async () => {
        storeState.accounts = [
            {
                id: 'existing',
                custody: {
                    kind: 'hardware',
                    device: LEDGER_DEVICE,
                    accountIndex: 1,
                },
                chains: { algorand: { address: 'LEDGER_ALGO' } },
            },
        ]
        const { current } = renderImport()

        await current.importAccounts([hardwareEntry('0xledger', 'ethereum')])

        expect(storeState.accounts).toHaveLength(2)
    })
})

const LEDGER_DEVICE = {
    manufacturer: 'ledger',
    deviceId: 'DE:AD:BE:EF',
    deviceName: 'Ledger Nano X',
    transportType: 'ble',
} as const

function hardwareEntry(
    address: string,
    chain: 'algorand' | 'ethereum' | 'base',
): PulledAccount {
    return {
        address,
        group: address,
        chain,
        addressPayload: {
            type: 'hardware',
            address,
            deviceId: LEDGER_DEVICE.deviceId,
            deviceName: LEDGER_DEVICE.deviceName,
            accountIndex: 0,
            manufacturer: LEDGER_DEVICE.manufacturer,
            transportType: LEDGER_DEVICE.transportType,
            customName: 'My Ledger',
        },
        secretsPayload: null,
    }
}

function watchChainEntry(address: string): PulledAccount {
    return {
        address,
        group: address,
        chain: 'ethereum',
        addressPayload: { type: 'watch', address, customName: 'Eth watch' },
        secretsPayload: null,
    }
}

describe('useCloudBackupImport restoring enablement', () => {
    const recordedWatch = (
        address: string,
        chain: string,
        enabledBy?: string,
    ): PulledAccount =>
        ({
            address,
            group: 'WALGO',
            chain,
            addressPayload: {
                type: 'watch',
                address,
                customName: null,
                ...(enabledBy ? { enabledAt: 1, enabledBy } : {}),
            },
            secretsPayload: null,
        }) as PulledAccount

    test('re-enables the chains a record carries as restored', async () => {
        const { current } = renderImport()

        await current.importAccounts([
            recordedWatch('WALGO', 'algorand', 'created'),
            recordedWatch('0xwatch', 'ethereum', 'user'),
        ])

        expect(storeState.accounts).toEqual([
            expect.objectContaining({
                chains: {
                    algorand: {
                        address: 'WALGO',
                        enabledAt: expect.any(Number),
                        enabledBy: 'restore',
                    },
                    ethereum: {
                        address: '0xwatch',
                        enabledAt: expect.any(Number),
                        enabledBy: 'restore',
                    },
                },
            }),
        ])
    })

    test('restores the entries of a record written before enablement as created', async () => {
        const { current } = renderImport()

        await current.importAccounts([recordedWatch('WALGO', 'algorand')])

        expect(storeState.accounts[0]?.chains.algorand?.enabledBy).toBe(
            'created',
        )
    })

    test('leaves an account already on the device out of the probe', async () => {
        storeState.accounts = [
            {
                id: 'held',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'WALGO' } },
            } as never,
        ]
        const { current } = renderImport()

        const summary = await current.importAccounts([
            recordedWatch('WALGO', 'algorand', 'created'),
        ])

        expect(summary.skippedDuplicate).toBe(1)
        expect(discoverChainsMock).not.toHaveBeenCalled()
    })

    test('looks for activity once per restored account, after the batch', async () => {
        const { current } = renderImport()

        await current.importAccounts([
            recordedWatch('WALGO', 'algorand', 'created'),
            recordedWatch('0xwatch', 'ethereum', 'created'),
            watchAccount('OTHER'),
        ])

        expect(
            discoverChainsMock.mock.calls.map(([accountId]) => accountId),
        ).toEqual(storeState.accounts.map(account => account.id))
    })
})
