/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type {
    HardwareWalletDerivedAccount,
    HardwareWalletTransport,
} from '@perawallet/wallet-core-hardware-wallet'

const mockNavigate = vi.fn()
const mockGetAddress = vi.fn()
const mockDisconnectTransport = vi.fn()
const mockConnect = vi.fn()
const mockGetProviderRegistry = vi.fn()
const mockErrorToast = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'index' in options) {
                return `Account #${String(options.index)}`
            }
            return key
        },
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: vi.fn(),
        infoToast: vi.fn(),
        errorToast: mockErrorToast,
        successToast: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        hardwareWalletRegistry: {
            getProvider: mockGetProviderRegistry,
        },
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: {
            deviceId: 'device-1',
            deviceName: 'Fred Nano X',
            transportType: 'ble',
            accounts: [
                {
                    address: 'AAA111',
                    publicKey: new Uint8Array([1]),
                    accountIndex: 0,
                },
                {
                    address: 'BBB222',
                    publicKey: new Uint8Array([2]),
                    accountIndex: 1,
                },
            ],
        },
    }),
}))

const { mockPrefetch, mockRequest, mockQueryClient } = vi.hoisted(() => {
    const mockPrefetch = vi.fn().mockResolvedValue(undefined)
    const mockRequest = vi.fn().mockResolvedValue(undefined)
    const mockQueryClient = {}
    return { mockPrefetch, mockRequest, mockQueryClient }
})

// useLedgerAccountPreview is included because the screen hook imports
// LedgerAccountInfoContent (whose hook chain references it) at module load;
// it is never invoked in these specs (the sheet content is not rendered).
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    prefetchLedgerAccountPreview: mockPrefetch,
    useLedgerAccountPreview: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({}),
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => mockQueryClient,
}))

import { useLedgerSelectAccountsScreen } from '../useLedgerSelectAccountsScreen'

const buildTransport = (): HardwareWalletTransport =>
    ({
        getAddress: mockGetAddress,
        signTransaction: vi.fn(),
        disconnect: mockDisconnectTransport,
    }) as unknown as HardwareWalletTransport

const buildAccount = (
    accountIndex: number,
    address: string,
): HardwareWalletDerivedAccount => ({
    address,
    publicKey: new Uint8Array([accountIndex]),
    accountIndex,
})

describe('useLedgerSelectAccountsScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset()
        mockGetAddress.mockReset()
        mockDisconnectTransport.mockReset()
        mockConnect.mockReset()
        mockGetProviderRegistry.mockReset()
        mockErrorToast.mockReset()
        mockPrefetch.mockClear()
        mockRequest.mockClear()

        const transport = buildTransport()
        mockConnect.mockResolvedValue(transport)
        mockDisconnectTransport.mockResolvedValue(undefined)
        mockGetProviderRegistry.mockReturnValue({ connect: mockConnect })
    })

    it('exposes the route accounts unchanged on initial render', () => {
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.accounts).toHaveLength(2)
        expect(result.current.accounts[0].accountIndex).toBe(0)
        expect(result.current.accounts[1].accountIndex).toBe(1)
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('appends one new account at the next index on handleFindAnother', async () => {
        mockGetAddress.mockResolvedValueOnce(buildAccount(2, 'CCC333'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockConnect).toHaveBeenCalledTimes(1)
        expect(mockConnect).toHaveBeenCalledWith('device-1')
        expect(mockGetAddress).toHaveBeenCalledTimes(1)
        expect(mockGetAddress).toHaveBeenCalledWith(2, false)
        expect(result.current.accounts).toHaveLength(3)
        expect(result.current.accounts[2]).toEqual({
            address: 'CCC333',
            publicKey: new Uint8Array([2]),
            accountIndex: 2,
        })
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('reuses the connected transport across taps and increments index', async () => {
        mockGetAddress
            .mockResolvedValueOnce(buildAccount(2, 'CCC333'))
            .mockResolvedValueOnce(buildAccount(3, 'DDD444'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })
        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockConnect).toHaveBeenCalledTimes(1)
        expect(mockGetAddress).toHaveBeenNthCalledWith(1, 2, false)
        expect(mockGetAddress).toHaveBeenNthCalledWith(2, 3, false)
        expect(result.current.accounts).toHaveLength(4)
        expect(result.current.accounts[3].accountIndex).toBe(3)
    })

    it('is a no-op while a fetch is in flight', async () => {
        let resolveFetch: (
            value: HardwareWalletDerivedAccount,
        ) => void = () => {}
        mockGetAddress.mockImplementationOnce(
            () =>
                new Promise<HardwareWalletDerivedAccount>(resolve => {
                    resolveFetch = resolve
                }),
        )

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            void result.current.handleFindAnother()
        })

        await waitFor(() => {
            expect(result.current.isFetchingMore).toBe(true)
        })

        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockGetAddress).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFetch(buildAccount(2, 'CCC333'))
        })

        await waitFor(() => {
            expect(result.current.isFetchingMore).toBe(false)
        })
    })

    it('shows an error toast and clears loading when connect fails', async () => {
        mockConnect.mockReset()
        mockConnect.mockRejectedValueOnce(new Error('BLE unavailable'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        expect(result.current.accounts).toHaveLength(2)
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('shows an error toast and clears loading when getAddress fails', async () => {
        mockGetAddress.mockRejectedValueOnce(new Error('Ledger app closed'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        expect(result.current.accounts).toHaveLength(2)
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('does not surface a toast or setState if the screen unmounts during a fetch', async () => {
        let rejectFetch: (reason: Error) => void = () => {}
        mockGetAddress.mockImplementationOnce(
            () =>
                new Promise<HardwareWalletDerivedAccount>(
                    (_resolve, reject) => {
                        rejectFetch = reject
                    },
                ),
        )

        const { result, unmount } = renderHook(() =>
            useLedgerSelectAccountsScreen(),
        )

        act(() => {
            void result.current.handleFindAnother()
        })

        await waitFor(() => {
            expect(result.current.isFetchingMore).toBe(true)
        })

        unmount()

        await act(async () => {
            rejectFetch(new Error('Connection lost'))
        })

        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('blocks canContinue while a fetch is in flight', async () => {
        let resolveFetch: (
            value: HardwareWalletDerivedAccount,
        ) => void = () => {}
        mockGetAddress.mockImplementationOnce(
            () =>
                new Promise<HardwareWalletDerivedAccount>(resolve => {
                    resolveFetch = resolve
                }),
        )

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.toggleSelection('AAA111')
        })

        expect(result.current.canContinue).toBe(true)

        act(() => {
            void result.current.handleFindAnother()
        })

        await waitFor(() => {
            expect(result.current.isFetchingMore).toBe(true)
        })

        expect(result.current.canContinue).toBe(false)

        await act(async () => {
            resolveFetch(buildAccount(2, 'CCC333'))
        })

        await waitFor(() => {
            expect(result.current.canContinue).toBe(true)
        })
    })

    it('disconnects the transport on unmount after a successful tap', async () => {
        mockGetAddress.mockResolvedValueOnce(buildAccount(2, 'CCC333'))

        const { result, unmount } = renderHook(() =>
            useLedgerSelectAccountsScreen(),
        )

        await act(async () => {
            await result.current.handleFindAnother()
        })

        unmount()

        await waitFor(() => {
            expect(mockDisconnectTransport).toHaveBeenCalledTimes(1)
        })
    })

    it('prefetches a preview for every route account on mount', async () => {
        renderHook(() => useLedgerSelectAccountsScreen())

        await waitFor(() => {
            expect(mockPrefetch).toHaveBeenCalledWith(
                mockQueryClient,
                expect.anything(),
                'AAA111',
                'mainnet',
            )
            expect(mockPrefetch).toHaveBeenCalledWith(
                mockQueryClient,
                expect.anything(),
                'BBB222',
                'mainnet',
            )
        })
    })

    it('opens the info bottom sheet with address and accountIndex', () => {
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.handleInfoPress('AAA111', 0)
        })

        expect(mockRequest).toHaveBeenCalledTimes(1)
        const arg = mockRequest.mock.calls[0][0]
        expect(arg.options).toEqual({ size: 'lg' })
        expect(arg.contents).toBeTruthy()
    })

    it('prefetches a newly found account', async () => {
        mockGetAddress.mockResolvedValueOnce(buildAccount(2, 'CCC333'))
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })

        await waitFor(() => {
            expect(mockPrefetch).toHaveBeenCalledWith(
                mockQueryClient,
                expect.anything(),
                'CCC333',
                'mainnet',
            )
        })
    })
})
