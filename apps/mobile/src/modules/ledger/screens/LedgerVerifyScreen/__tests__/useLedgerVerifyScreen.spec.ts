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

const { mockVerify, mockExit, mockSetConfetti, mockConnect, mockDisconnect } =
    vi.hoisted(() => ({
        mockVerify: vi.fn(),
        mockExit: vi.fn(),
        mockSetConfetti: vi.fn(),
        mockConnect: vi.fn(),
        mockDisconnect: vi.fn(),
    }))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))
vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mockExit }),
    useShouldPlayConfetti: () => ({ setShouldPlayConfetti: mockSetConfetti }),
}))
vi.mock('@modules/ledger/utils', () => ({
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
    isValidAlgorandAddress: (address?: string) =>
        typeof address === 'string' && !address.startsWith('!!'),
}))

const derived = (address: string, accountIndex: number) => ({
    address,
    publicKey: new Uint8Array([accountIndex]),
    accountIndex,
})

beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockResolvedValue({
        getAddress: vi.fn(),
        signTransaction: vi.fn(),
        disconnect: mockDisconnect.mockResolvedValue(undefined),
    })
    mockVerify.mockResolvedValue(undefined)
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
        expect(result.current.verifyTargets).toEqual([d0])
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
            publicKey: new Uint8Array([9]),
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
})
