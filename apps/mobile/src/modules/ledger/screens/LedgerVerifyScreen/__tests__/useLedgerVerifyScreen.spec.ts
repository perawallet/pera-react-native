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
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual }
})

import { useLedgerVerifyScreen } from '../useLedgerVerifyScreen'

const {
    mockVerify,
    mockExit,
    mockSetConfetti,
    mockConnect,
    mockDisconnect,
    mockSheetRequest,
} = vi.hoisted(() => ({
    mockVerify: vi.fn(),
    mockExit: vi.fn(),
    mockSetConfetti: vi.fn(),
    mockConnect: vi.fn(),
    mockDisconnect: vi.fn(),
    mockSheetRequest: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
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
    getLedgerErrorPreset: () => ({ title: 't', body: 'b' }),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
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
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    isValidAlgorandAddress: (address?: string) =>
        typeof address === 'string' && !address.startsWith('!!'),
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
        | { kind: 'rekeyed'; authAccount: ReturnType<typeof derived> }
    >
    for (const sel of selected) {
        const acc = sel.kind === 'derived' ? sel.account : sel.authAccount
        if (acc.accountIndex === accountIndex) return acc.address
    }
    return 'UNKNOWN'
}

beforeEach(() => {
    vi.clearAllMocks()
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
                { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
                { kind: 'rekeyed', address: 'REKEYED_B', authAccount: d0 },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())

        await waitFor(() => expect(result.current.areAllVerified).toBe(true))
        expect(mockVerify).toHaveBeenCalledTimes(1)
        expect(mockVerify).toHaveBeenCalledWith(expect.anything(), 0)
        expect(result.current.verifyTargets).toEqual([
            {
                address: 'LEDGER0',
                publicKey: new Uint8Array([0]),
                accountIndex: 0,
            },
        ])
    })

    it('handleAdd imports derived as hardware, rekeyed as watch+rekeyAddress, auto-includes auth, skips already-imported and invalid', async () => {
        const d0 = derived('LEDGER0', 0)
        useAccountsStore.getState().setAccounts([
            {
                type: AccountTypes.watch,
                address: 'ALREADY',
            } as WalletAccount,
        ])
        routeParams.current = {
            deviceId: 'dev',
            deviceName: 'Nano',
            transportType: 'ble',
            selectedAccounts: [
                { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
                { kind: 'rekeyed', address: 'ALREADY', authAccount: d0 },
                { kind: 'rekeyed', address: '!!bad', authAccount: d0 },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())
        await waitFor(() => expect(result.current.areAllVerified).toBe(true))

        act(() => {
            result.current.handleAdd()
        })

        const accounts = useAccountsStore.getState().accounts
        const hw = accounts.find(a => a.address === 'LEDGER0')
        const watch = accounts.find(a => a.address === 'REKEYED_A')
        expect(hw?.type).toBe(AccountTypes.hardware)
        expect(watch?.type).toBe(AccountTypes.watch)
        expect(watch?.rekeyAddress).toBe('LEDGER0')
        expect(accounts.filter(a => a.address === 'ALREADY')).toHaveLength(1)
        expect(accounts.find(a => a.address === '!!bad')).toBeUndefined()
        expect(mockExit).toHaveBeenCalledTimes(1)
        expect(mockSetConfetti).toHaveBeenCalledWith(true)
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
                { kind: 'rekeyed', address: 'REKEYED_X', authAccount: badAuth },
            ],
        }

        const { result } = renderHook(() => useLedgerVerifyScreen())
        await waitFor(() => expect(result.current.areAllVerified).toBe(true))

        act(() => {
            result.current.handleAdd()
        })

        const accounts = useAccountsStore.getState().accounts
        expect(accounts.find(a => a.address === 'REKEYED_X')).toBeUndefined()
        expect(
            accounts.find(a => a.address === '!!invalidauth'),
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
                type: AccountTypes.watch,
                address,
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
            expect(upgraded.type).toBe(AccountTypes.hardware)
            expect(upgraded.name).toBe('My Cold Wallet')
            expect(upgraded.id).toBe('watch-LEDGER0')
            expect(
                upgraded.type === AccountTypes.hardware &&
                    upgraded.hardwareDetails,
            ).toEqual({
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
            expect(accounts[0].type).toBe(AccountTypes.watch)
            // The brand-new LEDGER1 is withheld too: a declined confirmation
            // aborts the add wholesale instead of importing a partial set.
            expect(accounts.find(a => a.address === 'LEDGER1')).toBeUndefined()
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
                    { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
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
            const auth = accounts.find(a => a.address === 'LEDGER0')
            const rekeyed = accounts.find(a => a.address === 'REKEYED_A')
            expect(auth?.type).toBe(AccountTypes.hardware)
            expect(rekeyed?.type).toBe(AccountTypes.watch)
            expect(rekeyed?.rekeyAddress).toBe('LEDGER0')
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
                    { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
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
            expect(accounts[0].type).toBe(AccountTypes.watch)
            expect(
                accounts.find(a => a.address === 'REKEYED_A'),
            ).toBeUndefined()
        })

        it('re-binds hardwareDetails when the address exists as hardware under a different device id', async () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'hw-1',
                    name: 'Ledger 1',
                    type: AccountTypes.hardware,
                    address: 'LEDGER0',
                    hardwareDetails: {
                        manufacturer: 'ledger',
                        deviceId: 'forgotten-device',
                        deviceName: 'Nano',
                        accountIndex: 0,
                        transportType: 'ble',
                    },
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
            expect(
                rebound.type === AccountTypes.hardware &&
                    rebound.hardwareDetails.deviceId,
            ).toBe('dev')
            expect(rebound.name).toBe('Ledger 1')
            expect(mockExit).toHaveBeenCalledTimes(1)
        })

        it('re-imports an unchanged hardware account as a pure no-op', async () => {
            const untouched = {
                id: 'hw-1',
                type: AccountTypes.hardware,
                address: 'LEDGER0',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'dev',
                    deviceName: 'Nano',
                    accountIndex: 0,
                    transportType: 'ble',
                },
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
                    { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
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
            const names = accounts.map(a => [a.address, a.name])
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
                    type: AccountTypes.hardware,
                    address: 'OLDLEDGER',
                    hardwareDetails: {
                        manufacturer: 'ledger',
                        deviceId: 'other-dev',
                        deviceName: 'Nano S',
                        accountIndex: 0,
                        transportType: 'ble',
                    },
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
                .accounts.find(a => a.address === 'LEDGER0')
            expect(added?.name).toBe('ledger.default_account_name#2')
        })
    })
})
