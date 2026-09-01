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

import {
    describe,
    test,
    expect,
    beforeAll,
    beforeEach,
    afterEach,
    afterAll,
    vi,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { setupServer } from 'msw/node'
import algosdk from 'algosdk'
import { createHash } from 'crypto'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-blockchain/test-handlers'
import {
    indicesToAlgo25Seed,
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    quantumAddressCandidates,
    SeedScheme,
} from '@perawallet/wallet-core-kms'
import { useImportAccount } from '../useImportAccount'
import { useAccountsStore } from '../../store'
import { DuplicateAccountError } from '../../errors'

// Pinned quantum test vector — same mnemonic and independently-verified
// addresses as packages/kms/src/crypto/__tests__/quantumAddressCandidates.spec.ts,
// so the on-chain probe (real Falcon derivation, not mocked here) resolves to
// addresses this file can register MSW handlers for.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'
const CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const LEGACY_ADDRESS =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'
const TEST_MNEMONIC_INDICES = mnemonicWordsToIndices(TEST_MNEMONIC.split(' '))!
// The algo25/HD KMS hooks are mocked, so any 25-entry buffer will do there.
const DUMMY_INDICES = new Uint16Array(25)

const server = setupServer()

// Fallback used by tests that don't care about the probe outcome — neither
// candidate has on-chain activity, so the decision collapses to "canonical
// only" and the rest of the test can behave like the old single-derivation flow.
const mockNeitherQuantumAddressExists = () =>
    server.use(
        mockAlgodAccountInformation({
            address: CANONICAL_ADDRESS,
            response: {},
        }),
        mockAlgodAccountInformation({ address: LEGACY_ADDRESS, response: {} }),
    )

const uuidSpies = vi.hoisted(() => ({ v7: vi.fn() }))

// Test-only stand-in for the quantum address derivation: deterministic per
// seed (so repeated imports of the same mnemonic hit the duplicate guard)
// and distinct across seeds. Not the real Falcon derivation — that's covered
// by the kms package's own tests (useQuantum.test.ts, useKMS.test.ts) — this
// only needs to exercise useImportAccount's dedup/branching logic.
const deriveTestQuantumAddress = (seed: Uint8Array): string =>
    algosdk.encodeAddress(
        new Uint8Array(createHash('sha512-256').update(seed).digest()),
    )

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
    KeyContext: { Address: 0 },
    XHDWalletAPI: class {},
    fromSeed: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-blockchain')
    >('@perawallet/wallet-core-blockchain')
    return {
        ...actual,
        // getAlgorandClient stays real — the quantum probe's on-chain reads
        // go through it and MSW intercepts the underlying fetch calls.
        encodeAlgorandAddress: vi.fn((address: Uint8Array) =>
            Buffer.from(address).toString('base64'),
        ),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...actual,
        generateOrderedUniqueId: uuidSpies.v7,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const mockKeyStoreExport = vi.fn()

const kmsMock = vi.hoisted(() => ({
    getKey: vi.fn(),
    getKeyOrThrow: vi.fn(),
    createHDWalletKey: vi.fn(),
    createAlgo25Key: vi.fn(),
    createQuantumKey: vi.fn(),
    removeKeyAndChildren: vi.fn(),
    persistHDMasterKey: vi.fn(),
    generateDerivedKey: vi.fn(),
    withExportedKey: vi.fn(),
    // Test double for the real childId->seedId resolver: mirrors the
    // deterministic suffixes this file's mocks/fixtures already use
    // (quantumSignKeyId/algo25SignKeyId), rather than exercising the real
    // keystore-metadata lookup.
    seedIdOf: vi.fn((keyPairId?: string) => {
        if (!keyPairId) return undefined
        for (const suffix of ['-quantum-pqk1', '-quantum', '-ed25519']) {
            if (keyPairId.endsWith(suffix)) {
                return keyPairId.slice(0, -suffix.length)
            }
        }
        return undefined
    }),
}))

const prepareHDMasterKeyMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-kms', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-kms')
    >('@perawallet/wallet-core-kms')
    return {
        ...actual,
        useKMS: vi.fn(() => kmsMock),
        prepareHDMasterKey: prepareHDMasterKeyMock,
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => 'ios',
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

describe('useImportAccount', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        useAccountsStore.setState({ accounts: [] })
        vi.clearAllMocks()
        uuidSpies.v7.mockReset()
        kmsMock.getKey.mockReset()
        kmsMock.getKeyOrThrow.mockReset()
        kmsMock.createHDWalletKey.mockReset()
        kmsMock.createAlgo25Key.mockReset()
        kmsMock.createQuantumKey.mockReset()
        kmsMock.removeKeyAndChildren.mockReset()
        kmsMock.generateDerivedKey.mockReset()
        kmsMock.withExportedKey.mockReset()
        mockKeyStoreExport.mockReset()

        kmsMock.getKey.mockReturnValue(null)
        kmsMock.getKeyOrThrow.mockReturnValue(null)
        kmsMock.createHDWalletKey.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Bip39 },
            },
        })
        kmsMock.createAlgo25Key.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'ALGO25_PUBLIC_KEY',
        })
        // Address/signKeyId vary by `derivation` (and the seed id by
        // `reuseSeedId`) so the dual-probe branch can mint canonical and
        // legacy without them colliding on the same address.
        kmsMock.createQuantumKey.mockImplementation(
            async (params?: {
                id?: string
                mnemonicIndices?: Uint16Array
                derivation?: string
                reuseSeedId?: string
            }) => {
                const isLegacy = params?.derivation === PQ_DERIVATION_LEGACY
                const seedKeyId = params?.reuseSeedId ?? params?.id ?? 'QSEED1'
                return {
                    seedKey: {
                        id: seedKeyId,
                        type: 'seed',
                        algorithm: 'raw',
                        extractable: true,
                        metadata: { scheme: SeedScheme.Quantum },
                    },
                    address: isLegacy ? LEGACY_ADDRESS : CANONICAL_ADDRESS,
                    signKeyId: isLegacy
                        ? `${seedKeyId}-quantum`
                        : `${seedKeyId}-quantum-pqk1`,
                }
            },
        )
        kmsMock.removeKeyAndChildren.mockResolvedValue(undefined)
        kmsMock.generateDerivedKey.mockResolvedValue('ks-derived-1')
        mockKeyStoreExport.mockResolvedValue({
            publicKey: new Uint8Array(32).fill(2),
        })
        kmsMock.withExportedKey.mockImplementation(
            async (keyId: string, handler: (keyData: any) => any) => {
                const keyData = await mockKeyStoreExport(keyId)
                return handler(keyData)
            },
        )
        prepareHDMasterKeyMock.mockReset()
        prepareHDMasterKeyMock.mockResolvedValue({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
        })
    })

    test('hd wallet path: prepares import session, does not create an account', async () => {
        prepareHDMasterKeyMock.mockResolvedValueOnce({
            keyId: 'WALLET1',
            rootKey: new Uint8Array(96).fill(1),
            entropy: new Uint8Array(32).fill(2),
        })

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'hdWallet',
            })
        })

        expect(imported.type).toBe('hdWallet')
        expect(imported.walletKeyId).toBe('WALLET1')
        expect(imported.derivationType).toBe(9)
        // No WalletAccount should have been pushed to the store yet.
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        // createHDWalletKey must not be called in the new flow.
        expect(kmsMock.createHDWalletKey).not.toHaveBeenCalled()
    })

    test('hd wallet path: surfaces prepareHDMasterKey errors', async () => {
        prepareHDMasterKeyMock.mockRejectedValueOnce(
            new Error('Invalid mnemonic'),
        )

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'hdWallet',
                }),
            ).rejects.toThrow('Invalid mnemonic')
        })
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('imports algo25 account with mnemonic', async () => {
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'ALGO25_PUBLIC_KEY',
        })

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonicIndices: DUMMY_INDICES,
        })
        expect(imported.address).toBe('ALGO25_PUBLIC_KEY')
        expect(imported.type).toBe('algo25')
        // keyPairId is the deterministic ed25519 child of the seed.
        expect(imported.keyPairId).toBe('WALLET1-ed25519')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('uses the seed reference from createAlgo25Key without consulting getKey (regression: stale useMemo)', async () => {
        // Simulate the stale-useMemo race: the freshly-minted key isn't yet
        // visible to getKey, which reads from a useMemo bound to the previous
        // render. Without passing the seed reference through, the import
        // would fall back to creating a new no-mnemonic key (random address).
        kmsMock.createAlgo25Key.mockResolvedValueOnce({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'CORRECT_ADDRESS',
        })
        kmsMock.getKey.mockReturnValue(null)

        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'algo25',
            })
        })

        expect(kmsMock.createAlgo25Key).toHaveBeenCalledTimes(1)
        expect(kmsMock.createAlgo25Key).toHaveBeenCalledWith({
            mnemonicIndices: DUMMY_INDICES,
        })
        expect(kmsMock.getKey).not.toHaveBeenCalled()
        expect(imported.address).toBe('CORRECT_ADDRESS')
        expect(imported.keyPairId).toBe('WALLET1-ed25519')
    })

    test('throws when createAlgo25Key fails', async () => {
        kmsMock.createAlgo25Key.mockRejectedValueOnce(
            new Error('Import failed'),
        )

        uuidSpies.v7.mockImplementationOnce(() => 'WALLET1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'algo25',
                }),
            ).rejects.toThrow('Import failed')
        })
    })

    test('rejects a second import of the same address within one batch (no re-render between calls)', async () => {
        kmsMock.createAlgo25Key.mockResolvedValue({
            seedKey: {
                id: 'WALLET1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Algo25 },
            },
            address: 'SAME_ADDRESS',
        })
        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        // Two back-to-back imports, no re-render between them — mirrors the
        // Pera Web / ASB import loop.
        await act(async () => {
            await result.current({
                mnemonicIndices: DUMMY_INDICES,
                type: 'algo25',
            })
            await expect(
                result.current({
                    mnemonicIndices: DUMMY_INDICES,
                    type: 'algo25',
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        // The duplicate attempt's keystore entries were swept (seed + child).
        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('WALLET1')
    })

    test('imports quantum account with explicit quantum type', async () => {
        mockNeitherQuantumAddressExists()
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(kmsMock.createQuantumKey).toHaveBeenCalledWith({
            mnemonicIndices: TEST_MNEMONIC_INDICES,
            derivation: PQ_DERIVATION_CANONICAL,
            reuseSeedId: undefined,
        })
        // Neither derivation has on-chain activity, so only the canonical
        // child is minted — a single-element list.
        expect(imported).toHaveLength(1)
        expect(imported[0].type).toBe('quantum')
        expect(imported[0].address).toBe(CANONICAL_ADDRESS)
        // keyPairId is the scheme-agnostic, canonically-derived quantum
        // signing child of the seed — import always mints the canonical child.
        expect(imported[0].keyPairId).toBe('QSEED1-quantum-pqk1')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('rejects a duplicate quantum import without minting anything the second time', async () => {
        mockNeitherQuantumAddressExists()
        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
            await expect(
                result.current({
                    mnemonicIndices: TEST_MNEMONIC_INDICES,
                    type: 'quantum',
                }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })

        // The address is filtered out before minting on the second call, so
        // there is no freshly-minted key to sweep and nothing was deleted.
        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(1)
        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('imports the new canonical account and leaves an already-held legacy account untouched', async () => {
        // Regression: both derivations exist on chain, but the legacy
        // address is already an account in the store (e.g. imported before
        // canonical derivation existed). The pre-existing duplicate must be
        // filtered out before minting, not discovered after canonical's
        // sibling child has already been minted onto the same seed — the
        // old post-mint sweep would have deleted canonical's just-persisted
        // keys along with the "duplicate" legacy attempt.
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: { amount: 1_000_000 },
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: { amount: 5_000_000 },
            }),
        )
        useAccountsStore.setState({
            accounts: [
                {
                    id: 'existing-legacy-1',
                    type: 'quantum',
                    address: LEGACY_ADDRESS,
                    keyPairId: 'PRIOR_SEED-quantum',
                },
            ],
        })
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(imported).toHaveLength(1)
        expect(imported[0].address).toBe(CANONICAL_ADDRESS)
        // Only the new (canonical) leg was minted — the already-held legacy
        // leg was never attempted.
        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(1)
        expect(kmsMock.createQuantumKey).toHaveBeenCalledWith({
            mnemonicIndices: TEST_MNEMONIC_INDICES,
            derivation: PQ_DERIVATION_CANONICAL,
            reuseSeedId: undefined,
        })
        // Canonical's freshly-minted seed/key survive: nothing was removed.
        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
        expect(useAccountsStore.getState().accounts).toHaveLength(2)
    })

    test('rejects the import when every probed candidate is already held', async () => {
        mockNeitherQuantumAddressExists()
        useAccountsStore.setState({
            accounts: [
                {
                    id: 'existing-canonical-1',
                    type: 'quantum',
                    address: CANONICAL_ADDRESS,
                    keyPairId: 'PRIOR_SEED-quantum-pqk1',
                },
            ],
        })

        const { result } = renderHook(() => useImportAccount())

        await expect(
            result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            }),
        ).rejects.toBeInstanceOf(DuplicateAccountError)

        // Nothing was minted at all — the only candidate ("neither exists"
        // resolves to canonical-only) was already held.
        expect(kmsMock.createQuantumKey).not.toHaveBeenCalled()
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('imports both accounts when both derivations exist on chain', async () => {
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: { amount: 1_000_000 },
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: { amount: 5_000_000 },
            }),
        )
        let counter = 0
        uuidSpies.v7.mockImplementation(() => `ACC${++counter}`)

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(imported.map((a: any) => a.address).sort()).toEqual(
            [CANONICAL_ADDRESS, LEGACY_ADDRESS].sort(),
        )
        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(2)
        expect(useAccountsStore.getState().accounts).toHaveLength(2)
    })

    test('shares a single seed record between both derivations instead of creating two', async () => {
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: { amount: 1_000_000 },
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: { amount: 5_000_000 },
            }),
        )
        let counter = 0
        uuidSpies.v7.mockImplementation(() => `ACC${++counter}`)

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(2)
        const [[first], [second]] = kmsMock.createQuantumKey.mock.calls
        // The canonical leg mints a fresh seed; the legacy leg attaches to
        // that SAME seed via reuseSeedId instead of importing the entropy a
        // second time — exactly one seed record backs both children (see
        // createQuantumKey's own tests in packages/kms for the guarantee
        // that reuseSeedId skips keyStore.import entirely).
        expect(first.reuseSeedId).toBeUndefined()
        expect(first.id).toBeUndefined()
        expect(second.reuseSeedId).toBe('QSEED1')
        expect(second.id).toBeUndefined()
    })

    test('imports only the legacy account when just the legacy derivation exists on chain', async () => {
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: {},
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: { amount: 2_000_000 },
            }),
        )
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(imported).toHaveLength(1)
        expect(imported[0].address).toBe(LEGACY_ADDRESS)
        expect(imported[0].keyPairId).toBe('QSEED1-quantum')
        expect(kmsMock.createQuantumKey).toHaveBeenCalledWith({
            mnemonicIndices: TEST_MNEMONIC_INDICES,
            derivation: PQ_DERIVATION_LEGACY,
            reuseSeedId: undefined,
        })
    })

    test('treats a zero-balance account with held assets as existing on chain', async () => {
        // Requirement: "exists" is any on-chain footprint, not balance alone
        // — an account can be meaningful (an asset/app holder, or another
        // account's auth-addr) while holding zero ALGO.
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: {
                    amount: 0,
                    assets: [{ 'asset-id': 1, amount: 5, 'is-frozen': false }],
                },
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: {},
            }),
        )
        uuidSpies.v7.mockImplementationOnce(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(imported).toHaveLength(1)
        expect(imported[0].address).toBe(CANONICAL_ADDRESS)
    })

    test('imports both derivations when the on-chain probe fails', async () => {
        server.use(
            mockAlgodAccountInformation({
                address: CANONICAL_ADDRESS,
                response: {},
                status: 500,
            }),
            mockAlgodAccountInformation({
                address: LEGACY_ADDRESS,
                response: {},
                status: 500,
            }),
        )
        let counter = 0
        uuidSpies.v7.mockImplementation(() => `ACC${++counter}`)

        const { result } = renderHook(() => useImportAccount())

        let imported: any
        await act(async () => {
            imported = await result.current({
                mnemonicIndices: TEST_MNEMONIC_INDICES,
                type: 'quantum',
            })
        })

        expect(imported).toHaveLength(2)
        expect(imported.map((a: any) => a.address).sort()).toEqual(
            [CANONICAL_ADDRESS, LEGACY_ADDRESS].sort(),
        )
    })

    test('same mnemonic imported as quantum vs algo25 yields different addresses and both coexist', async () => {
        // Real derivations on both sides (algosdk ed25519 vs the KMS quantum
        // derivation) prove the two account types cannot collide by address
        // in the store — not just that the mocks were wired differently.
        const generated = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(generated.sk)
        const mnemonicIndices = mnemonicWordsToIndices(mnemonic.split(' '))!

        const [canonical, legacy] = quantumAddressCandidates(
            algosdk.seedFromMnemonic(mnemonic),
        )
        server.use(
            mockAlgodAccountInformation({
                address: canonical.address,
                response: {},
            }),
            mockAlgodAccountInformation({
                address: legacy.address,
                response: {},
            }),
        )

        kmsMock.createAlgo25Key.mockImplementation(
            async ({
                mnemonicIndices: idx,
            }: {
                mnemonicIndices: Uint16Array
            }) => ({
                seedKey: {
                    id: 'A25SEED',
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme: SeedScheme.Algo25 },
                },
                address: algosdk
                    .mnemonicToSecretKey(
                        Array.from(idx, mnemonicIndexToWord).join(' '),
                    )
                    .addr.toString(),
            }),
        )
        kmsMock.createQuantumKey.mockImplementation(
            async ({
                mnemonicIndices: idx,
            }: {
                mnemonicIndices: Uint16Array
            }) => {
                const seed = indicesToAlgo25Seed(idx)
                return {
                    seedKey: {
                        id: 'QSEED1',
                        type: 'seed',
                        algorithm: 'raw',
                        extractable: true,
                        metadata: { scheme: SeedScheme.Quantum },
                    },
                    address: deriveTestQuantumAddress(seed),
                    signKeyId: 'QSEED1-quantum',
                }
            },
        )

        let counter = 0
        uuidSpies.v7.mockImplementation(() => `ACC${++counter}`)

        const { result } = renderHook(() => useImportAccount())

        let asAlgo25: any
        let asQuantum: any
        await act(async () => {
            asAlgo25 = await result.current({ mnemonicIndices, type: 'algo25' })
            asQuantum = await result.current({
                mnemonicIndices,
                type: 'quantum',
            })
        })

        expect(asAlgo25.type).toBe('algo25')
        // Quantum import always returns a list (one or two derivations).
        expect(asQuantum).toHaveLength(1)
        expect(asQuantum[0].type).toBe('quantum')
        expect(asQuantum[0].address).not.toBe(asAlgo25.address)
        expect(useAccountsStore.getState().accounts).toHaveLength(2)
    })

    test('repeated quantum imports of the same mnemonic derive the same address', async () => {
        const generated = algosdk.generateAccount()
        const mnemonic = algosdk.secretKeyToMnemonic(generated.sk)
        const mnemonicIndices = mnemonicWordsToIndices(mnemonic.split(' '))!

        // The pre-mint duplicate filter compares against the SAME candidate
        // addresses the probe derives, so the mock must return those same
        // addresses (not an independent stand-in) for the dedup guard to see
        // the second import as the identical address it really is.
        const [canonical, legacy] = quantumAddressCandidates(
            algosdk.seedFromMnemonic(mnemonic),
        )
        kmsMock.createQuantumKey.mockImplementation(
            async (params?: { derivation?: string }) => ({
                seedKey: {
                    id: 'QSEED1',
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme: SeedScheme.Quantum },
                },
                address:
                    params?.derivation === PQ_DERIVATION_LEGACY
                        ? legacy.address
                        : canonical.address,
                signKeyId: 'QSEED1-quantum',
            }),
        )
        server.use(
            mockAlgodAccountInformation({
                address: canonical.address,
                response: {},
            }),
            mockAlgodAccountInformation({
                address: legacy.address,
                response: {},
            }),
        )

        uuidSpies.v7.mockImplementation(() => 'ACC1')

        const { result } = renderHook(() => useImportAccount())

        await act(async () => {
            await result.current({ mnemonicIndices, type: 'quantum' })
            await expect(
                result.current({ mnemonicIndices, type: 'quantum' }),
            ).rejects.toBeInstanceOf(DuplicateAccountError)
        })
        // Discriminate the quantum path: the first import went through
        // createQuantumKey (not the algo25 branch); the repeat is filtered
        // out before minting, so createQuantumKey is called only once and
        // nothing is ever swept.
        expect(kmsMock.createQuantumKey).toHaveBeenCalledTimes(1)
        expect(kmsMock.createAlgo25Key).not.toHaveBeenCalled()
        expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })
})
