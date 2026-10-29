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

// @vitest-environment jsdom
import {
    describe,
    test,
    expect,
    beforeEach,
    vi,
    type MockInstance,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHDImportSession } from '../useHDImportSession'
import { accountsChainAdapters } from '../../chain-adapter'
import { useHDImportSessionStore } from '../../import-session'
import { useAccountsStore } from '../../store'
import { HDImportSessionNotFoundError } from '../../errors'
import type { AccountsState, LocalAccount } from '../../models'
import { buildAccount, addressOn, hdIndexOf } from '../../credentials'
import {
    ALGORAND,
    BASE,
    deriveInMemoryOn,
    ETHEREUM,
    familyHdAddress,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import {
    fakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const kmsMock = vi.hoisted(() => ({
    persistHDMasterKey: vi.fn(),
    removeKeyAndChildren: vi.fn().mockResolvedValue(undefined),
}))
const prepareMock = vi.hoisted(() => vi.fn())
const withDefaultChainsMock = vi.hoisted(() =>
    vi.fn(async <A>(draft: A): Promise<A> => draft),
)

vi.mock('../../store', async importOriginal => ({
    ...(await importOriginal<typeof import('../../store')>()),
    withDefaultChains: withDefaultChainsMock,
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    useKMS: () => kmsMock,
    prepareHDMasterKey: prepareMock,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: vi.fn(() => 'gen-id'),
    }
})

const INDICES = new Uint16Array(24)

const discovered = (): LocalAccount =>
    buildAccount({
        id: 'discovered-1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        },
        chainId: TESTNET_SCOPE.chainId,
        chains: {
            [TESTNET_SCOPE.chainId]: {
                address: 'ADDR-A',
                keyPairId: 'w-1-acc1-idx0-dt9',
            },
        },
    })

describe('useHDImportSession', () => {
    let discoverWalletAccounts: MockInstance<
        AccountsState['discoverWalletAccounts']
    >

    beforeEach(() => {
        vi.clearAllMocks()
        useHDImportSessionStore.getState().resetState()
        useAccountsStore.setState({ accounts: [] })
        discoverWalletAccounts = vi
            .spyOn(useAccountsStore.getState(), 'discoverWalletAccounts')
            .mockResolvedValue([])
        prepareMock.mockResolvedValue({
            keyId: 'w-1',
            rootKey: new Uint8Array(96).fill(7),
            entropy: new Uint8Array(32).fill(3),
            mnemonic: 'one two three',
        })
        kmsMock.persistHDMasterKey.mockResolvedValue({
            seedKey: {
                id: 'w-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: {},
            },
        })
    })

    test('prepareImport stores rootKey/entropy in the session store', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        let prep: any
        await act(async () => {
            prep = await result.current.prepareImport({
                mnemonicIndices: INDICES,
            })
        })
        expect(prep.walletKeyId).toBe('w-1')
        expect(prepareMock).toHaveBeenCalledWith({ mnemonicIndices: INDICES })
        expect(useHDImportSessionStore.getState().pending?.walletKeyId).toBe(
            'w-1',
        )
    })

    test('cancelImport clears the session', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        act(() => result.current.cancelImport())
        expect(useHDImportSessionStore.getState().pending).toBeNull()
    })

    test('commitImport persists the keystore root and saves selected accounts', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        const selected = [discovered()]

        let saved: any
        await act(async () => {
            saved = await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: selected,
            })
        })

        expect(kmsMock.persistHDMasterKey).toHaveBeenCalledWith(
            expect.objectContaining({ keyId: 'w-1' }),
        )
        expect(
            fakeAccountsChain().derivation.deriveAccount,
        ).toHaveBeenCalledWith(expect.anything(), 'w-1', 1, 0, {
            scheme: 'ed25519',
            networkId: 'testnet',
        })
        expect(saved).toHaveLength(1)
        expect(addressOn(saved[0], TESTNET_SCOPE)).toBe('ADDR-A')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(useHDImportSessionStore.getState().pending).toBeNull()
    })

    test('commitImport walks the wallet across every chain once, declining nothing when every offered index was kept', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        useHDImportSessionStore
            .getState()
            .recordDiscovered('w-1', [{ account: 1, keyIndex: 0 }])

        await act(async () => {
            await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: [discovered()],
            })
        })

        expect(discoverWalletAccounts).toHaveBeenCalledExactlyOnceWith('w-1', {
            declinedIndexes: [],
            rootKey: expect.any(Uint8Array),
        })
    })

    test("commitImport hands the walk its own copy of the root key, untouched by the session's reset", async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        const sessionRootKey =
            useHDImportSessionStore.getState().pending!.rootKey

        await act(async () => {
            await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: [discovered()],
            })
        })

        const walkRootKey = discoverWalletAccounts.mock.calls[0][1]?.rootKey
        expect(walkRootKey).not.toBe(sessionRootKey)
        expect(walkRootKey).toEqual(new Uint8Array(96).fill(7))
        expect(sessionRootKey.every(byte => byte === 0)).toBe(true)
    })

    test('commitImport passes the offered indexes the user left unselected as declined', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        useHDImportSessionStore.getState().recordDiscovered('w-1', [
            { account: 0, keyIndex: 0 },
            { account: 1, keyIndex: 0 },
            { account: 1, keyIndex: 3 },
        ])

        await act(async () => {
            await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: [discovered()],
            })
        })

        expect(discoverWalletAccounts).toHaveBeenCalledExactlyOnceWith('w-1', {
            declinedIndexes: [
                { account: 0, keyIndex: 0 },
                { account: 1, keyIndex: 3 },
            ],
            rootKey: expect.any(Uint8Array),
        })
    })

    test('commitImport persists and returns each account with its default chains, then walks the wallet', async () => {
        const order: string[] = []
        withDefaultChainsMock.mockImplementationOnce(async draft => {
            order.push('defaults')
            return {
                ...draft,
                chains: {
                    ...draft.chains,
                    second: { address: 'SECOND', keyPairId: 'second-key' },
                },
            }
        })
        discoverWalletAccounts.mockImplementation(async () => {
            order.push('discover')
            return []
        })
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        let saved: LocalAccount[] = []
        await act(async () => {
            saved = await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: [discovered()],
            })
        })

        expect(Object.keys(saved[0].chains)).toEqual([
            TESTNET_SCOPE.chainId,
            'second',
        ])
        expect(useAccountsStore.getState().accounts).toEqual(saved)
        expect(order).toEqual(['defaults', 'discover'])
    })

    test('commitImport removes the persisted seed and keeps the session when a child derive rejects', async () => {
        vi.mocked(
            fakeAccountsChain().derivation.deriveAccount,
        ).mockRejectedValueOnce(new Error('derive failed'))
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        await act(async () => {
            await expect(
                result.current.commitImport({
                    walletKeyId: 'w-1',
                    selectedAccounts: [discovered()],
                }),
            ).rejects.toThrow('derive failed')
        })

        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('w-1')
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('commitImport throws and keeps session pending if walletKeyId mismatches', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        await act(async () => {
            await expect(
                result.current.commitImport({
                    walletKeyId: 'wrong',
                    selectedAccounts: [],
                }),
            ).rejects.toThrow(HDImportSessionNotFoundError)
        })
        expect(useHDImportSessionStore.getState().pending?.walletKeyId).toBe(
            'w-1',
        )
        expect(kmsMock.persistHDMasterKey).not.toHaveBeenCalled()
    })

    test('discoverImportAccounts scans the scope with the session root key', async () => {
        const { adapter } = fakeAccountsChain()
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        let found: LocalAccount[] = []
        await act(async () => {
            found = await result.current.discoverImportAccounts({
                walletKeyId: 'w-1',
            })
        })

        expect(adapter.createPublicKeyGetter).toHaveBeenCalledWith(
            new Uint8Array(96).fill(7),
        )
        expect(adapter.checkActivity).toHaveBeenCalledWith(
            expect.any(Array),
            TESTNET_SCOPE,
        )
        // Nothing is active, so discovery falls back to the first account.
        expect(found.map(account => account.custody)).toEqual([
            { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
        ])
        expect(
            useHDImportSessionStore.getState().pending?.discoveredIndexes,
        ).toEqual([{ account: 0, keyIndex: 0 }])
        expect(kmsMock.persistHDMasterKey).not.toHaveBeenCalled()
    })

    test('discoverImportAccounts leaves out of the offered indexes one whose address the wallet already holds', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        let found: LocalAccount[] = []
        await act(async () => {
            found = await result.current.discoverImportAccounts({
                walletKeyId: 'w-1',
            })
        })
        useAccountsStore.setState({ accounts: [{ ...found[0], id: 'held' }] })

        await act(async () => {
            await result.current.discoverImportAccounts({ walletKeyId: 'w-1' })
        })

        expect(
            useHDImportSessionStore.getState().pending?.discoveredIndexes,
        ).toEqual([])
    })

    test('discoverImportAccounts refuses a wallet the session did not prepare', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))

        await expect(
            result.current.discoverImportAccounts({ walletKeyId: 'w-1' }),
        ).rejects.toThrow(HDImportSessionNotFoundError)
    })

    describe('with more than one HD discovery chain', () => {
        const MAINNET = { chainId: ALGORAND, networkId: 'mainnet' }
        const CHAIN_IDS = [ALGORAND, ETHEREUM, BASE]
        type HookResult = {
            current: ReturnType<typeof useHDImportSession>
        }

        const setUpChains = (active: Record<string, string[]> = {}) => {
            const families = registerChainFamilies(CHAIN_IDS)
            for (const chainId of CHAIN_IDS) {
                Object.assign(accountsChainAdapters.get(chainId), {
                    localKeyKinds: [
                        {
                            seed: 'bip39',
                            signingScheme:
                                chainId === ALGORAND ? 'ed25519' : 'secp256k1',
                            isHd: true,
                        },
                    ],
                })
            }
            deriveInMemoryOn(ALGORAND)
            for (const chainId of CHAIN_IDS) {
                families.checkActivity
                    .get(chainId)!
                    .mockImplementation(
                        async (probed: string[]) =>
                            new Map(
                                probed.map(a => [
                                    a,
                                    (active[chainId] ?? []).includes(a),
                                ]),
                            ),
                    )
            }
            return families
        }

        const prepare = async (result: HookResult) => {
            await act(async () => {
                await result.current.prepareImport({
                    mnemonicIndices: INDICES,
                })
            })
        }

        const discover = async (result: HookResult) => {
            let found: LocalAccount[] = []
            await act(async () => {
                found = await result.current.discoverImportAccounts({
                    walletKeyId: 'w-1',
                })
            })
            return found
        }

        test('persists the seed once from copies, marks the session persisted and finds an index active on one chain only', async () => {
            setUpChains({ [BASE]: [familyHdAddress('evm', 2, 0)] })
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)
            const session = useHDImportSessionStore.getState().pending!

            const found = await discover(result)
            await discover(result)

            expect(kmsMock.persistHDMasterKey).toHaveBeenCalledOnce()
            const persisted = kmsMock.persistHDMasterKey.mock.calls[0][0]
            expect(persisted.keyId).toBe('w-1')
            expect(persisted.rootKey).not.toBe(session.rootKey)
            expect(persisted.entropy).not.toBe(session.entropy)
            expect(
                useHDImportSessionStore.getState().pending?.isSeedPersisted,
            ).toBe(true)
            expect(found.map(hdIndexOf)).toEqual([{ account: 2, keyIndex: 0 }])
        })

        test('records only the indexes whose candidate no stored account holds an entry of', async () => {
            setUpChains({
                [ALGORAND]: [familyHdAddress('algorand', 1, 0)],
                [ETHEREUM]: [familyHdAddress('evm', 0, 0)],
            })
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)
            // Index 0/0 landed earlier with only its EVM entry.
            useAccountsStore.setState({
                accounts: [
                    buildAccount({
                        custody: {
                            kind: 'local',
                            seed: 'bip39',
                            hd: { account: 0, keyIndex: 0 },
                        },
                        chainId: ETHEREUM,
                        chains: {
                            [ETHEREUM]: {
                                address: familyHdAddress('evm', 0, 0),
                                keyPairId: 'held-key',
                            },
                        },
                    }),
                ],
            })

            await discover(result)

            expect(
                useHDImportSessionStore.getState().pending?.discoveredIndexes,
            ).toEqual([{ account: 1, keyIndex: 0 }])
        })

        test('commit skips saving the seed and derives each distinct key of a selected account once, on its chain', async () => {
            const families = setUpChains({
                [BASE]: [familyHdAddress('evm', 2, 0)],
            })
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)
            const found = await discover(result)
            kmsMock.persistHDMasterKey.mockClear()

            await act(async () => {
                await result.current.commitImport({
                    walletKeyId: 'w-1',
                    selectedAccounts: found,
                })
            })

            expect(kmsMock.persistHDMasterKey).not.toHaveBeenCalled()
            const derivedOn = (chainId: typeof ALGORAND) =>
                vi
                    .mocked(families.derivations.get(chainId)!.deriveAccount)
                    .mock.calls.map(([, seed, account, keyIndex]) => [
                        seed,
                        account,
                        keyIndex,
                    ])
            expect(derivedOn(ALGORAND)).toContainEqual(['w-1', 2, 0])
            expect(derivedOn(ETHEREUM)).toContainEqual(['w-1', 2, 0])
            expect(derivedOn(BASE)).not.toContainEqual(['w-1', 2, 0])
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        })

        test('cancelImport removes a persisted seed and leaves an unpersisted one alone', async () => {
            setUpChains()
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)

            act(() => result.current.cancelImport())
            expect(kmsMock.removeKeyAndChildren).not.toHaveBeenCalled()

            await prepare(result)
            await discover(result)
            act(() => result.current.cancelImport())

            expect(
                kmsMock.removeKeyAndChildren,
            ).toHaveBeenCalledExactlyOnceWith('w-1')
            expect(useHDImportSessionStore.getState().pending).toBeNull()
        })

        test('prepareImport removes the seed a previous persisted session left behind', async () => {
            setUpChains()
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)
            await discover(result)

            await prepare(result)

            expect(
                kmsMock.removeKeyAndChildren,
            ).toHaveBeenCalledExactlyOnceWith('w-1')
            expect(
                useHDImportSessionStore.getState().pending?.isSeedPersisted,
            ).toBeUndefined()
        })

        test('returns nothing when no chain answers, leaving the persisted seed for cancelImport to remove', async () => {
            const families = setUpChains()
            for (const checkActivity of families.checkActivity.values()) {
                checkActivity.mockRejectedValue(new Error('offline'))
            }
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)

            await expect(discover(result)).resolves.toEqual([])
            act(() => result.current.cancelImport())

            expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('w-1')
        })

        test('saves the seed again on commit after a failed commit removed it', async () => {
            const families = setUpChains()
            const { result } = renderHook(() => useHDImportSession(MAINNET))
            await prepare(result)
            const found = await discover(result)
            vi.mocked(
                families.derivations.get(ALGORAND)!.deriveAccount,
            ).mockRejectedValueOnce(new Error('derive failed'))

            await act(async () => {
                await expect(
                    result.current.commitImport({
                        walletKeyId: 'w-1',
                        selectedAccounts: found,
                    }),
                ).rejects.toThrow('derive failed')
            })
            kmsMock.persistHDMasterKey.mockClear()
            await act(async () => {
                await result.current.commitImport({
                    walletKeyId: 'w-1',
                    selectedAccounts: found,
                })
            })

            expect(kmsMock.persistHDMasterKey).toHaveBeenCalledOnce()
        })
    })
})
