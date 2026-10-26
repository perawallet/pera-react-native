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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
    authorityOf,
    hardwareDetailsOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual }
})

import { useLedgerVerifyScreen } from '../useLedgerVerifyScreen'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandAddressCodec,
} from '@test-utils/algorandAccountsAdapter'

const {
    mockVerify,
    mockExit,
    mockSetConfetti,
    mockConnect,
    mockDisconnect,
    mockSheetRequest,
    mockErrorPreset,
    mockProve,
    handoff,
} = vi.hoisted(() => ({
    mockProve: vi.fn(),
    mockErrorPreset: vi.fn(),
    handoff: { isHandoffTab: false, closeHandoffTab: vi.fn() },
    mockVerify: vi.fn(),
    mockExit: vi.fn(),
    mockSetConfetti: vi.fn(),
    mockConnect: vi.fn(),
    mockDisconnect: vi.fn(),
    mockSheetRequest: vi.fn(),
}))

vi.mock('@modules/ledger/hooks', async importOriginal => ({
    ...(await importOriginal<object>()),
    useLedgerExpandedTabHandoff: () => ({
        isPopupSurface: false,
        openLedgerExpandedTab: vi.fn(),
        ...handoff,
    }),
}))
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))
vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'algorand',
}))
vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    ledgerAppNameFor: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        // Surfaces `number` interpolation so default-name assertions can pin
        // the numbering, while every other key round-trips unchanged.
        t: (k: string, options?: Record<string, unknown>) =>
            options && 'number' in options
                ? `${k}#${String(options.number)}`
                : k,
    }),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockSheetRequest }),
}))
vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mockExit }),
    useShouldPlayConfetti: () => ({ setShouldPlayConfetti: mockSetConfetti }),
}))
vi.mock('@modules/ledger/utils', async () => ({
    // Real deserializers (from the submodule, not the barrel — the barrel
    // drags the signing-package error chain in); the hook decodes the
    // serialized route params.
    ...(await vi.importActual<
        typeof import('../../../utils/serializedLedgerAccounts')
    >('../../../utils/serializedLedgerAccounts')),
    ...(await vi.importActual<
        typeof import('../../../utils/requireLedgerProvider')
    >('../../../utils/requireLedgerProvider')),
    getLedgerErrorPreset: mockErrorPreset,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        // Before bootstrap registers a chain, the scope reads the tier name.
        chains: { has: () => false },
        keyValueStorage: {
            getItem: vi.fn().mockResolvedValue(null),
            setItem: vi.fn().mockResolvedValue(undefined),
            removeItem: vi.fn().mockResolvedValue(undefined),
        },
        hardwareWalletRegistry: {
            getProvider: () => ({ connect: mockConnect }),
        },
    }),
}))
vi.mock('@perawallet/wallet-core-ledger', async () => {
    // Real timeout semantics (via the shared util) so the hung-call cases
    // below exercise genuine expiry under fake timers; ceilings inlined.
    const { withTimeout } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        verifyLedgerAddress: mockVerify,
        LedgerProviderNotFoundError: class extends Error {},
        LedgerAddressMismatchError: class extends Error {
            constructor(expected: string, actual: string) {
                super(`expected ${expected} but got ${actual}`)
            }
        },
        classifyLedgerError: (e: unknown) => e as Error,
        // Stand-ins for the claim helpers; packages/ledger's own spec covers
        // them and the device read behind `proveLedgerHolders`.
        ledgerHolderClaim: ({
            id,
            accountIndex,
            addresses,
        }: {
            id: string
            accountIndex: number
            addresses: Record<string, string>
        }) => {
            const chainId = ['algorand', 'ethereum'].find(
                chain => addresses[chain] !== undefined,
            )
            return chainId
                ? {
                      holderId: id,
                      chainId,
                      accountIndex,
                      address: addresses[chainId],
                  }
                : undefined
        },
        isLedgerClaimMetBy: (claim: { address: string }, address: string) =>
            claim.address.toLowerCase() === address.toLowerCase(),
        ledgerClaimsByChain: (claims: Array<{ chainId: string }>) => {
            const byChain = new Map<string, typeof claims>()
            for (const claim of claims) {
                byChain.set(claim.chainId, [
                    ...(byChain.get(claim.chainId) ?? []),
                    claim,
                ])
            }
            return byChain
        },
        proveLedgerHolders: mockProve,
        withLedgerConnectionTimeout: <T>(p: Promise<T>, op: string) =>
            withTimeout(p, 20_000, op),
        withLedgerConfirmationTimeout: <T>(p: Promise<T>, op: string) =>
            withTimeout(p, 300_000, op),
    }
})

const routeParams = vi.hoisted(() => ({
    current: {} as Record<string, unknown>,
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    getSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
}))

// Route params carry the serialized (JSON-safe) shape; the hook decodes it.
const derived = (address: string, accountIndex: number) => ({
    address,
    publicKeyHex: accountIndex.toString(16).padStart(2, '0'),
    accountIndex,
})

// The device echoes back the account it verified; by default it returns the
// address the route expects for that index (the honest-device case).
const expectedAddressFor = (accountIndex: number): string => {
    const selected = routeParams.current.selectedAccounts as Array<
        | { kind: 'derived'; account: ReturnType<typeof derived> }
        | { kind: 'delegated'; authAccount: ReturnType<typeof derived> }
    >
    for (const sel of selected) {
        const acc = sel.kind === 'derived' ? sel.account : sel.authAccount
        if (acc.accountIndex === accountIndex) return acc.address
    }
    return 'UNKNOWN'
}

afterEach(() => {
    vi.restoreAllMocks()
})

beforeEach(() => {
    registerAlgorandAccountsAdapter()
    vi.clearAllMocks()
    registerAlgorandAddressCodec()
    // A `!!` prefix marks the fixtures' invalid addresses.
    vi.spyOn(addressCodecs.get(LEGACY_CHAIN_ID), 'isValid').mockImplementation(
        address => !address.startsWith('!!'),
    )
    mockConnect.mockResolvedValue({
        getAddress: vi.fn(),
        signTransaction: vi.fn(),
        disconnect: mockDisconnect.mockResolvedValue(undefined),
    })
    mockVerify.mockImplementation(
        async (_transport: unknown, accountIndex: number) => ({
            address: expectedAddressFor(accountIndex),
            publicKey: new Uint8Array([accountIndex]),
            accountIndex,
        }),
    )
    mockSheetRequest.mockResolvedValue(true)
    mockErrorPreset.mockReturnValue({
        kind: 'connection_failed',
        title: 't',
        body: 'b',
        isRetryable: true,
    })
    handoff.isHandoffTab = false
    useAccountsStore.getState().setAccounts([])
})

describe('useLedgerVerifyScreen', () => {
    it('verifies one target per unique auth account (derived self, rekeyed auth, deduped)', async () => {
        const d0 = derived('LEDGER0', 0)
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                { kind: 'derived', account: d0 },
                { kind: 'delegated', address: 'REKEYED_A', authAccount: d0 },
                { kind: 'delegated', address: 'REKEYED_B', authAccount: d0 },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())

        await waitFor(() => expect(result.current.areAllVerified).toBe(true))
        expect(mockVerify).toHaveBeenCalledTimes(1)
        expect(mockVerify).toHaveBeenCalledWith(expect.anything(), 0)
        expect(mockConnect).toHaveBeenCalledWith('dev', 'algorand')
        expect(result.current.verifyTargets).toEqual([
            {
                address: 'LEDGER0',
                publicKey: new Uint8Array([0]),
                accountIndex: 0,
            },
        ])
    })

    it('handleAdd imports derived as hardware, rekeyed as watch accounts under their Ledger authority, auto-includes auth, skips already-imported and invalid', async () => {
        const d0 = derived('LEDGER0', 0)
        useAccountsStore.getState().setAccounts([
            {
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'ALREADY' } },
            } as WalletAccount,
        ])
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                { kind: 'delegated', address: 'REKEYED_A', authAccount: d0 },
                { kind: 'delegated', address: 'ALREADY', authAccount: d0 },
                { kind: 'delegated', address: '!!bad', authAccount: d0 },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())
        await waitFor(() => expect(result.current.areAllVerified).toBe(true))

        act(() => {
            result.current.handleAdd()
        })

        const accounts = useAccountsStore.getState().accounts
        const hw = accounts.find(a => a.chains.algorand?.address === 'LEDGER0')
        const watch = accounts.find(
            a => a.chains.algorand?.address === 'REKEYED_A',
        )
        expect(hw?.custody.kind).toBe('hardware')
        expect(watch?.custody.kind).toBe('watch')
        expect(
            authorityOf(watch!, {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).toBe('LEDGER0')
        expect(
            accounts.filter(a => a.chains.algorand?.address === 'ALREADY'),
        ).toHaveLength(1)
        expect(
            accounts.find(a => a.chains.algorand?.address === '!!bad'),
        ).toBeUndefined()
        expect(mockExit).toHaveBeenCalledTimes(1)
        expect(mockSetConfetti).toHaveBeenCalledWith(true)
    })

    describe('in a Ledger pairing tab', () => {
        beforeEach(() => {
            handoff.isHandoffTab = true
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'usb',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }
        })

        it('shows the added result instead of leaving for the wallet home', async () => {
            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            act(() => {
                result.current.handleAdd()
            })

            await waitFor(() =>
                expect(result.current.isAddedInHandoffTab).toBe(true),
            )
            expect(
                useAccountsStore
                    .getState()
                    .accounts.some(
                        a => a.chains.algorand?.address === 'LEDGER0',
                    ),
            ).toBe(true)
            expect(mockExit).not.toHaveBeenCalled()
            expect(mockSetConfetti).not.toHaveBeenCalled()
        })

        it('closes the tab on Done and offers Cancel', async () => {
            const { result } = renderHook(() => useLedgerVerifyScreen())

            result.current.handleDone()

            expect(handoff.closeHandoffTab).toHaveBeenCalledTimes(1)
            expect(result.current.handleCancel).toBeDefined()
        })
    })

    it('offers no Cancel outside a Ledger pairing tab', () => {
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'usb',
            selectedAccounts: [
                { kind: 'derived', account: derived('LEDGER0', 0) },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())

        expect(result.current.handleCancel).toBeUndefined()
    })

    it('does not persist a rekeyed watch account when its auth account address is invalid', async () => {
        const badAuth = {
            address: '!!invalidauth',
            publicKeyHex: '09',
            accountIndex: 9,
        }
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                {
                    kind: 'delegated',
                    address: 'REKEYED_X',
                    authAccount: badAuth,
                },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())
        await waitFor(() => expect(result.current.areAllVerified).toBe(true))

        act(() => {
            result.current.handleAdd()
        })

        const accounts = useAccountsStore.getState().accounts
        expect(
            accounts.find(a => a.chains.algorand?.address === 'REKEYED_X'),
        ).toBeUndefined()
        expect(
            accounts.find(a => a.chains.algorand?.address === '!!invalidauth'),
        ).toBeUndefined()
    })

    describe('hung device calls', () => {
        afterEach(() => {
            vi.useRealTimers()
        })

        it('surfaces a timeout error instead of verifying forever when the confirmation hangs', async () => {
            vi.useFakeTimers()
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }
            // Silent BLE drop mid-verify: the confirmation APDU never settles.
            mockVerify.mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(() => useLedgerVerifyScreen())

            await act(async () => {
                await vi.advanceTimersByTimeAsync(300_001)
            })

            expect(result.current.errorPreset).toBeTruthy()
            expect(result.current.areAllVerified).toBe(false)
        })

        it('surfaces a timeout error when the connect never settles', async () => {
            vi.useFakeTimers()
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }
            mockConnect.mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(() => useLedgerVerifyScreen())

            await act(async () => {
                await vi.advanceTimersByTimeAsync(20_001)
            })

            expect(result.current.errorPreset).toBeTruthy()
        })
    })

    it('fails verification when the device returns a different address than expected', async () => {
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                { kind: 'derived', account: derived('LEDGER0', 0) },
            ],
        }
        // Seed swapped between fetch and verify: same index now derives a
        // different address.
        mockVerify.mockResolvedValue({
            address: 'OTHER_SEED_ADDR',
            publicKey: new Uint8Array([0]),
            accountIndex: 0,
        })

        const { result } = renderHook(() => useLedgerVerifyScreen())

        await waitFor(() => expect(result.current.errorPreset).toBeTruthy())
        expect(result.current.areAllVerified).toBe(false)
        expect(result.current.verifiedIndices.size).toBe(0)
    })

    describe('handleAdd collisions', () => {
        const watchOf = (address: string, name?: string): WalletAccount =>
            ({
                id: `watch-${address}`,
                ...(name ? { name } : {}),
                custody: { kind: 'watch' },
                chains: { algorand: { address: address } },
            }) as WalletAccount

        it('upgrades a watch account of a derived address to hardware after confirmation, preserving its name', async () => {
            useAccountsStore
                .getState()
                .setAccounts([watchOf('LEDGER0', 'My Cold Wallet')])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            expect(mockSheetRequest).toHaveBeenCalledTimes(1)
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            const upgraded = accounts[0]
            expect(upgraded.custody.kind).toBe('hardware')
            expect(upgraded.name).toBe('My Cold Wallet')
            expect(upgraded.id).toBe('watch-LEDGER0')
            expect(hardwareDetailsOf(upgraded)).toEqual({
                manufacturer: 'ledger',
                deviceId: 'dev',
                deviceName: 'Nano',
                accountIndex: 0,
                transportType: 'ble',
            })
            expect(mockSetConfetti).toHaveBeenCalledWith(true)
            expect(mockExit).toHaveBeenCalledTimes(1)
        })

        it('writes nothing and stays on the screen when the upgrade is declined', async () => {
            mockSheetRequest.mockResolvedValue(false)
            useAccountsStore.getState().setAccounts([watchOf('LEDGER0')])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                    { kind: 'derived', account: derived('LEDGER1', 1) },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].custody.kind).toBe('watch')
            // The brand-new LEDGER1 is withheld too: a declined confirmation
            // aborts the add wholesale instead of importing a partial set.
            expect(
                accounts.find(a => a.chains.algorand?.address === 'LEDGER1'),
            ).toBeUndefined()
            expect(mockExit).not.toHaveBeenCalled()
            expect(mockSetConfetti).not.toHaveBeenCalled()
        })

        it('upgrades a watch auth account and adds the rekeyed pair after confirmation', async () => {
            const d0 = derived('LEDGER0', 0)
            useAccountsStore.getState().setAccounts([watchOf('LEDGER0')])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    {
                        kind: 'delegated',
                        address: 'REKEYED_A',
                        authAccount: d0,
                    },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            const accounts = useAccountsStore.getState().accounts
            const auth = accounts.find(
                a => a.chains.algorand?.address === 'LEDGER0',
            )
            const rekeyed = accounts.find(
                a => a.chains.algorand?.address === 'REKEYED_A',
            )
            expect(auth?.custody.kind).toBe('hardware')
            expect(rekeyed?.custody.kind).toBe('watch')
            expect(
                authorityOf(rekeyed!, {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const),
            ).toBe('LEDGER0')
        })

        it('does not add the rekeyed pair when upgrading its watch auth is declined', async () => {
            mockSheetRequest.mockResolvedValue(false)
            const d0 = derived('LEDGER0', 0)
            useAccountsStore.getState().setAccounts([watchOf('LEDGER0')])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    {
                        kind: 'delegated',
                        address: 'REKEYED_A',
                        authAccount: d0,
                    },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].custody.kind).toBe('watch')
            expect(
                accounts.find(a => a.chains.algorand?.address === 'REKEYED_A'),
            ).toBeUndefined()
        })

        it('re-binds hardwareDetails when the address exists as hardware under a different device id', async () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'hw-1',
                    name: 'Ledger 1',
                    custody: {
                        kind: 'hardware',
                        device: {
                            manufacturer: 'ledger',
                            deviceId: 'forgotten-device',
                            deviceName: 'Nano',
                            transportType: 'ble',
                        },
                        accountIndex: 0,
                    },
                    chains: { algorand: { address: 'LEDGER0' } },
                } as WalletAccount,
            ])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            // Address match proves the same key — re-bind silently, no sheet.
            expect(mockSheetRequest).not.toHaveBeenCalled()
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            const rebound = accounts[0]
            expect(hardwareDetailsOf(rebound)?.deviceId).toBe('dev')
            expect(rebound.name).toBe('Ledger 1')
            expect(mockExit).toHaveBeenCalledTimes(1)
        })

        it('re-imports an unchanged hardware account as a pure no-op', async () => {
            const untouched = {
                id: 'hw-1',
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'dev',
                        deviceName: 'Nano',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                chains: { algorand: { address: 'LEDGER0' } },
            } as WalletAccount
            useAccountsStore.getState().setAccounts([untouched])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            await act(async () => {
                result.current.handleAdd()
            })

            expect(mockSheetRequest).not.toHaveBeenCalled()
            expect(useAccountsStore.getState().accounts).toEqual([untouched])
            expect(mockSetConfetti).not.toHaveBeenCalled()
            expect(mockExit).toHaveBeenCalledTimes(1)
        })
    })

    describe('default names', () => {
        it('assigns sequential default names to newly imported hardware accounts only', async () => {
            const d0 = derived('LEDGER0', 0)
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: d0 },
                    { kind: 'derived', account: derived('LEDGER1', 1) },
                    {
                        kind: 'delegated',
                        address: 'REKEYED_A',
                        authAccount: d0,
                    },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            act(() => {
                result.current.handleAdd()
            })

            const accounts = useAccountsStore.getState().accounts
            const names = accounts.map(a => [
                a.chains.algorand?.address,
                a.name,
            ])
            expect(names).toContainEqual([
                'LEDGER0',
                'ledger.default_account_name#1',
            ])
            expect(names).toContainEqual([
                'LEDGER1',
                'ledger.default_account_name#2',
            ])
            // Rekeyed watch entries are not Ledger accounts — no default name.
            expect(names).toContainEqual(['REKEYED_A', undefined])
        })

        it('continues numbering after the ledger accounts already in the wallet', async () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'hw-existing',
                    name: 'ledger.default_account_name#1',
                    custody: {
                        kind: 'hardware',
                        device: {
                            manufacturer: 'ledger',
                            deviceId: 'other-dev',
                            deviceName: 'Nano S',
                            transportType: 'ble',
                        },
                        accountIndex: 0,
                    },
                    chains: { algorand: { address: 'OLDLEDGER' } },
                } as WalletAccount,
            ])
            routeParams.current = {
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived('LEDGER0', 0) },
                ],
            }

            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            act(() => {
                result.current.handleAdd()
            })

            const added = useAccountsStore
                .getState()
                .accounts.find(a => a.chains.algorand?.address === 'LEDGER0')
            expect(added?.name).toBe('ledger.default_account_name#2')
        })
    })

    it('imports another seed at a device position the wallet holds as a new account', async () => {
        useAccountsStore.getState().setAccounts([
            {
                id: 'seed-a',
                name: 'ledger.default_account_name#1',
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'dev',
                        deviceName: 'Nano',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                chains: { algorand: { address: 'SEED_A' } },
            } as WalletAccount,
        ])
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                { kind: 'derived', account: derived('SEED_B', 0) },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())
        await waitFor(() => expect(result.current.areAllVerified).toBe(true))
        act(() => {
            result.current.handleAdd()
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(2)
        expect(accounts[0].chains.algorand?.address).toBe('SEED_A')
        expect(accounts[1]).toMatchObject({
            name: 'ledger.default_account_name#2',
            chains: { algorand: { address: 'SEED_B' } },
        })
    })

    describe('on Ethereum', () => {
        const ETH_LEDGER_0 = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
        const ETH_LEDGER_1 = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
        const ledgerOnAlgorand = (accountIndex: number): WalletAccount =>
            ({
                id: `hw-${accountIndex}`,
                name: 'ledger.default_account_name#1',
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'dev',
                        deviceName: 'Nano',
                        transportType: 'ble',
                    },
                    accountIndex,
                },
                chains: { algorand: { address: 'LEDGER0' } },
            }) as WalletAccount
        const importOnEthereum = async (
            ...accounts: ReturnType<typeof derived>[]
        ) => {
            routeParams.current = {
                chainId: 'ethereum',
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: accounts.map(account => ({
                    kind: 'derived',
                    account,
                })),
            }
            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )
            act(() => {
                result.current.handleAdd()
            })
            return result
        }
        // The same-wallet sheet's props, one entry per time it was shown.
        const sameWalletPrompts = () =>
            mockSheetRequest.mock.calls.map(
                ([request]) =>
                    (
                        request as {
                            contents: { props: Record<string, unknown> }
                        }
                    ).contents.props,
            )

        // The device reads `LEDGER0` at every index in the Algorand app.
        const proveAgainstDevice = async ({
            claims,
        }: {
            claims: Array<{ holderId: string; address: string }>
        }) =>
            new Set(
                claims
                    .filter(claim => claim.address === 'LEDGER0')
                    .map(claim => claim.holderId),
            )

        beforeEach(() => {
            mockSheetRequest.mockResolvedValue('read')
            mockProve.mockImplementation(proveAgainstDevice)
        })

        beforeEach(() => {
            if (!addressCodecs.has('ethereum')) {
                addressCodecs.register({
                    chainId: 'ethereum',
                    fromPublicKey: () => '',
                    isValid: (address: string) =>
                        /^0x[0-9a-fA-F]{40}$/.test(address),
                    normalize: (address: string) => address.toLowerCase(),
                    areEqual: (a: string, b: string) =>
                        a.toLowerCase() === b.toLowerCase(),
                    truncate: (address: string) => address,
                    resembles: () => false,
                    toPaymentUri: (address: string) => address,
                    parsePaymentUri: () => undefined,
                })
            }
        })

        it('verifies on the Ethereum app and creates a hardware account holding the device address', async () => {
            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() => expect(mockExit).toHaveBeenCalled())
            expect(mockConnect).toHaveBeenCalledWith('dev', 'ethereum')
            expect(mockSheetRequest).not.toHaveBeenCalled()
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].custody).toMatchObject({
                kind: 'hardware',
                accountIndex: 0,
            })
            expect(accounts[0].chains.ethereum?.address).toBe(
                ETH_LEDGER_0.toLowerCase(),
            )
            expect(accounts[0].chains.algorand).toBeUndefined()
        })

        it("attaches the entry to the device's account once the Algorand app reads that account's address", async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])

            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() =>
                expect(mockSetConfetti).toHaveBeenCalledWith(true),
            )
            expect(sameWalletPrompts()).toEqual([
                { appName: 'Algorand', failure: null },
            ])
            expect(mockProve).toHaveBeenCalledExactlyOnceWith({
                provider: expect.objectContaining({ connect: mockConnect }),
                deviceId: 'dev',
                chainId: 'algorand',
                claims: [
                    {
                        holderId: 'hw-0',
                        chainId: 'algorand',
                        accountIndex: 0,
                        address: 'LEDGER0',
                    },
                ],
            })
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].id).toBe('hw-0')
            expect(accounts[0].name).toBe('ledger.default_account_name#1')
            expect(accounts[0].chains.algorand?.address).toBe('LEDGER0')
            expect(accounts[0].chains.ethereum?.address).toBe(
                ETH_LEDGER_0.toLowerCase(),
            )
        })

        it("adds a separate account when the device's Algorand address at that index is another seed's", async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])
            mockProve.mockResolvedValue(new Set())

            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() =>
                expect(useAccountsStore.getState().accounts).toHaveLength(2),
            )
            const [held, created] = useAccountsStore.getState().accounts
            expect(held.chains.ethereum).toBeUndefined()
            expect(created).toMatchObject({
                name: 'ledger.default_account_name#2',
                custody: { kind: 'hardware', accountIndex: 0 },
                chains: { ethereum: { address: ETH_LEDGER_0.toLowerCase() } },
            })
            expect(created.chains.algorand).toBeUndefined()
        })

        it("joins without a prompt or a second read when the account's address in the same device app was just verified", async () => {
            if (!addressCodecs.has('base')) {
                addressCodecs.register({
                    ...addressCodecs.get('ethereum'),
                    chainId: 'base',
                })
            }
            useAccountsStore.getState().setAccounts([
                {
                    ...ledgerOnAlgorand(0),
                    chains: {
                        ethereum: { address: ETH_LEDGER_0.toLowerCase() },
                    },
                } as WalletAccount,
            ])
            routeParams.current = {
                chainId: 'base',
                deviceId: 'dev',
                deviceName: 'Nano',
                transportType: 'ble',
                selectedAccounts: [
                    { kind: 'derived', account: derived(ETH_LEDGER_0, 0) },
                ],
            }
            const { result } = renderHook(() => useLedgerVerifyScreen())
            await waitFor(() =>
                expect(result.current.areAllVerified).toBe(true),
            )

            act(() => {
                result.current.handleAdd()
            })

            await waitFor(() =>
                expect(mockSetConfetti).toHaveBeenCalledWith(true),
            )
            expect(mockSheetRequest).not.toHaveBeenCalled()
            expect(mockProve).not.toHaveBeenCalled()
            const [account, ...rest] = useAccountsStore.getState().accounts
            expect(rest).toEqual([])
            expect(account.id).toBe('hw-0')
            expect(account.chains.base?.address).toBe(
                ETH_LEDGER_0.toLowerCase(),
            )
        })

        it('asks again with the classified failure, logged, and adds a separate account when the user chooses to', async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            const readError = new Error('CLA_NOT_SUPPORTED')
            const appNotOpen = {
                kind: 'app_not_open',
                title: 'Open the app',
                body: 'Open the Algorand app on your Ledger.',
                isRetryable: true,
            }
            mockErrorPreset.mockReturnValue(appNotOpen)
            mockSheetRequest
                .mockResolvedValueOnce('read')
                .mockResolvedValueOnce('separate')
            mockProve.mockRejectedValue(readError)

            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() =>
                expect(useAccountsStore.getState().accounts).toHaveLength(2),
            )
            expect(mockErrorPreset).toHaveBeenCalledWith(
                readError,
                expect.any(Function),
                'Algorand',
            )
            expect(warn).toHaveBeenCalledWith(
                'Ledger same-wallet read failed',
                { chainId: 'algorand', error: readError },
            )
            expect(sameWalletPrompts()).toEqual([
                { appName: 'Algorand', failure: null },
                { appName: 'Algorand', failure: appNotOpen },
            ])
            expect(
                useAccountsStore.getState().accounts[0].chains.ethereum,
            ).toBeUndefined()
        })

        it('attaches once a retry finds the Algorand app open', async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])
            mockProve.mockRejectedValueOnce(new Error('Ethereum app open'))

            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() =>
                expect(
                    useAccountsStore.getState().accounts[0].chains.ethereum
                        ?.address,
                ).toBe(ETH_LEDGER_0.toLowerCase()),
            )
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            expect(sameWalletPrompts()).toHaveLength(2)
            expect(mockProve).toHaveBeenCalledTimes(2)
        })

        it('reports reading the device while the Algorand app reads, and stops after', async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])
            let answer: (proven: Set<string>) => void = () => {}
            mockProve.mockImplementation(
                () =>
                    new Promise<Set<string>>(resolve => {
                        answer = resolve
                    }),
            )

            const result = await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() =>
                expect(result.current.isReadingDevice).toBe(true),
            )
            await act(async () => {
                answer(new Set(['hw-0']))
            })
            await waitFor(() =>
                expect(mockSetConfetti).toHaveBeenCalledWith(true),
            )
            expect(result.current.isReadingDevice).toBe(false)
        })

        it('writes nothing when the user cancels the same-wallet prompt', async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])
            mockSheetRequest.mockResolvedValue(undefined)

            await importOnEthereum(derived(ETH_LEDGER_0, 0))

            await waitFor(() => expect(mockSheetRequest).toHaveBeenCalled())
            await act(async () => {})
            expect(useAccountsStore.getState().accounts).toEqual([
                ledgerOnAlgorand(0),
            ])
            expect(mockProve).not.toHaveBeenCalled()
            expect(mockExit).not.toHaveBeenCalled()
        })

        it('names only the accounts it creates', async () => {
            useAccountsStore.getState().setAccounts([ledgerOnAlgorand(0)])

            await importOnEthereum(
                derived(ETH_LEDGER_0, 0),
                derived(ETH_LEDGER_1, 1),
            )

            await waitFor(() =>
                expect(mockSetConfetti).toHaveBeenCalledWith(true),
            )
            expect(mockProve).toHaveBeenCalledOnce()
            const created = useAccountsStore
                .getState()
                .accounts.find(a => a.id !== 'hw-0')
            expect(created?.name).toBe('ledger.default_account_name#2')
            expect(created?.chains.ethereum?.address).toBe(
                ETH_LEDGER_1.toLowerCase(),
            )
        })
    })
})
