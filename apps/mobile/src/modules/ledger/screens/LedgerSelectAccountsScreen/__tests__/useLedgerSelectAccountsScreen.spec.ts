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
const mockExitAccountFlow = vi.fn()

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
            // Route params carry the serialized (JSON-safe) account shape.
            accounts: [
                { address: 'AAA111', publicKeyHex: '01', accountIndex: 0 },
                { address: 'BBB222', publicKeyHex: '02', accountIndex: 1 },
            ],
        },
    }),
}))

const {
    mockPrefetch,
    mockRequest,
    mockQueryClient,
    mockRekeyedScan,
    mockAllAccounts,
} = vi.hoisted(() => {
    const mockPrefetch = vi.fn().mockResolvedValue(undefined)
    const mockRequest = vi.fn().mockResolvedValue(undefined)
    const mockQueryClient = {}
    const mockRekeyedScan = vi.fn()
    const mockAllAccounts = vi.fn<() => { address: string; type: string }[]>(
        () => [],
    )
    return {
        mockPrefetch,
        mockRequest,
        mockQueryClient,
        mockRekeyedScan,
        mockAllAccounts,
    }
})

// useLedgerAccountPreview is included because the screen hook imports
// LedgerAccountInfoContent (whose hook chain references it) at module load;
// it is never invoked in these specs (the sheet content is not rendered).
// AccountTypes / useRekeyTransition are needed because
// useLedgerAccountInfoContent → AccountDisplay → useAccountTypeLabel pulls
// these in at module evaluation time.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAllAccounts(),
    prefetchLedgerAccountPreview: mockPrefetch,
    useLedgerAccountPreview: vi.fn(),
    useLedgerRekeyedScan: mockRekeyedScan,
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
    useRekeyTransition: vi.fn().mockReturnValue(null),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mockExitAccountFlow }),
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

// The hook no longer exposes the raw derived list; `selectableAccounts` is the
// canonical surface. This narrows it back to the derived accounts for assertions.
const derivedAccounts = (
    r: ReturnType<typeof useLedgerSelectAccountsScreen>,
): HardwareWalletDerivedAccount[] =>
    r.selectableAccounts.flatMap(s => (s.kind === 'derived' ? [s.account] : []))

describe('useLedgerSelectAccountsScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset()
        mockGetAddress.mockReset()
        mockDisconnectTransport.mockReset()
        mockConnect.mockReset()
        mockGetProviderRegistry.mockReset()
        mockErrorToast.mockReset()
        mockExitAccountFlow.mockReset()
        mockPrefetch.mockClear()
        mockRequest.mockClear()
        mockAllAccounts.mockReset()
        mockAllAccounts.mockReturnValue([])

        const transport = buildTransport()
        mockConnect.mockResolvedValue(transport)
        mockDisconnectTransport.mockResolvedValue(undefined)
        mockGetProviderRegistry.mockReturnValue({ connect: mockConnect })
        mockRekeyedScan.mockReturnValue({ rekeyed: [], isScanning: false })
    })

    it('reflects the route accounts as derived selectables on initial render', () => {
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        const derived = derivedAccounts(result.current)
        expect(derived).toHaveLength(2)
        expect(derived[0].accountIndex).toBe(0)
        expect(derived[1].accountIndex).toBe(1)
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
        expect(mockGetAddress).toHaveBeenCalledWith(2, true)
        const derived = derivedAccounts(result.current)
        expect(derived).toHaveLength(3)
        expect(derived[2]).toEqual({
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
        expect(mockGetAddress).toHaveBeenNthCalledWith(1, 2, true)
        expect(mockGetAddress).toHaveBeenNthCalledWith(2, 3, true)
        const derived = derivedAccounts(result.current)
        expect(derived).toHaveLength(4)
        expect(derived[3].accountIndex).toBe(3)
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
        expect(derivedAccounts(result.current)).toHaveLength(2)
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('shows an error toast and clears loading when getAddress fails', async () => {
        mockGetAddress.mockRejectedValueOnce(new Error('Ledger app closed'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })

        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        expect(derivedAccounts(result.current)).toHaveLength(2)
        expect(result.current.isFetchingMore).toBe(false)
    })

    it('releases the dead transport on failure so the next tap reconnects and succeeds', async () => {
        mockDisconnectTransport.mockResolvedValue(undefined)
        // Device slept / BLE dropped after the first connect.
        mockGetAddress
            .mockRejectedValueOnce(new Error('device disconnected'))
            .mockResolvedValueOnce(buildAccount(2, 'CCC333'))

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await act(async () => {
            await result.current.handleFindAnother()
        })
        expect(mockErrorToast).toHaveBeenCalledTimes(1)
        // The wedged handle is dropped, not kept for the next tap.
        expect(mockDisconnectTransport).toHaveBeenCalled()

        await act(async () => {
            await result.current.handleFindAnother()
        })
        expect(mockConnect).toHaveBeenCalledTimes(2)
        const derived = derivedAccounts(result.current)
        expect(derived).toHaveLength(3)
        expect(derived[2].address).toBe('CCC333')
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

    it('prefetches discovered rekeyed addresses', async () => {
        mockRekeyedScan.mockReturnValue({
            rekeyed: [
                {
                    kind: 'rekeyed',
                    address: 'REKEYED_A',
                    authAccount: {
                        address: 'AAA111',
                        publicKey: new Uint8Array([1]),
                        accountIndex: 0,
                    },
                },
            ],
            isScanning: false,
        })

        renderHook(() => useLedgerSelectAccountsScreen())

        await waitFor(() => {
            expect(mockPrefetch).toHaveBeenCalledWith(
                mockQueryClient,
                expect.anything(),
                'REKEYED_A',
                'mainnet',
            )
        })
    })

    it('does not re-prefetch already-prefetched accounts when the list grows', async () => {
        mockGetAddress.mockResolvedValueOnce(buildAccount(2, 'CCC333'))
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        await waitFor(() => {
            expect(mockPrefetch).toHaveBeenCalledWith(
                mockQueryClient,
                expect.anything(),
                'AAA111',
                'mainnet',
            )
        })

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

        const aaaCalls = mockPrefetch.mock.calls.filter(c => c[2] === 'AAA111')
        expect(aaaCalls).toHaveLength(1)
    })

    it('opens the info bottom sheet with address and accountIndex', () => {
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.handleInfoPress('AAA111', 0)
        })

        expect(mockRequest).toHaveBeenCalledTimes(1)
        const arg = mockRequest.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
        })
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

    it('navigates to LedgerVerify with selectedAccounts wrapped as derived LedgerSelectableAccount', () => {
        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.toggleSelection('AAA111')
        })

        act(() => {
            result.current.handleContinue()
        })

        expect(mockNavigate).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('LedgerVerify', {
            deviceId: 'device-1',
            deviceName: 'Fred Nano X',
            transportType: 'ble',
            selectedAccounts: [
                {
                    kind: 'derived',
                    account: {
                        address: 'AAA111',
                        publicKeyHex: '01',
                        accountIndex: 0,
                    },
                },
            ],
        })
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('reports areAllImported and exits the flow on continue when every discovered account is already imported', () => {
        mockAllAccounts.mockReturnValue([
            { address: 'AAA111', type: 'hardware' },
            { address: 'BBB222', type: 'hardware' },
        ])

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.areAllImported).toBe(true)
        // The button stays actionable so the user is not stuck on a screen
        // with nothing left to select.
        expect(result.current.canContinue).toBe(true)

        act(() => {
            result.current.handleContinue()
        })

        expect(mockExitAccountFlow).toHaveBeenCalledTimes(1)
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('exposes derived + scanned rekeyed as selectableAccounts', () => {
        mockRekeyedScan.mockReturnValue({
            rekeyed: [
                {
                    kind: 'rekeyed',
                    address: 'REKEYED_A',
                    authAccount: {
                        address: 'AAA111',
                        publicKey: new Uint8Array([1]),
                        accountIndex: 0,
                    },
                },
            ],
            isScanning: true,
        })

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.isScanning).toBe(true)
        const kinds = result.current.selectableAccounts.map(s => s.kind)
        expect(kinds).toEqual(['derived', 'derived', 'rekeyed'])
    })

    it('navigates with the rekeyed selectable and auto-included auth account', () => {
        const auth = {
            address: 'AAA111',
            publicKey: new Uint8Array([1]),
            accountIndex: 0,
        }
        mockRekeyedScan.mockReturnValue({
            rekeyed: [
                { kind: 'rekeyed', address: 'REKEYED_A', authAccount: auth },
            ],
            isScanning: false,
        })

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.toggleSelection('REKEYED_A')
        })
        act(() => {
            result.current.handleContinue()
        })

        const serializedAuth = {
            address: 'AAA111',
            publicKeyHex: '01',
            accountIndex: 0,
        }
        const arg = mockNavigate.mock.calls.find(
            c => c[0] === 'LedgerVerify',
        )?.[1] as { selectedAccounts: unknown[] }
        expect(arg.selectedAccounts).toEqual([
            {
                kind: 'rekeyed',
                address: 'REKEYED_A',
                authAccount: serializedAuth,
            },
            { kind: 'derived', account: serializedAuth },
        ])
    })

    it('keeps a derived address imported as a watch account selectable and marks it upgradeable', () => {
        mockAllAccounts.mockReturnValue([{ address: 'AAA111', type: 'watch' }])

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.alreadyImportedAddresses.has('AAA111')).toBe(
            false,
        )
        expect(result.current.upgradeableAddresses.has('AAA111')).toBe(true)
        expect(result.current.areAllImported).toBe(false)

        act(() => {
            result.current.toggleSelection('AAA111')
        })
        expect(result.current.selectedAddresses.has('AAA111')).toBe(true)

        act(() => {
            result.current.handleContinue()
        })
        const arg = mockNavigate.mock.calls.find(
            c => c[0] === 'LedgerVerify',
        )?.[1] as { selectedAccounts: Array<{ account: { address: string } }> }
        expect(arg.selectedAccounts[0].account.address).toBe('AAA111')
    })

    it('still disables a derived address imported as a hardware account', () => {
        mockAllAccounts.mockReturnValue([
            { address: 'AAA111', type: 'hardware' },
        ])

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.alreadyImportedAddresses.has('AAA111')).toBe(true)
        expect(result.current.upgradeableAddresses.has('AAA111')).toBe(false)

        act(() => {
            result.current.toggleSelection('AAA111')
        })
        expect(result.current.selectedAddresses.has('AAA111')).toBe(false)
    })

    it('keeps a rekeyed candidate disabled when its address already exists as a watch account', () => {
        // A rekeyed import IS a watch account — nothing to upgrade.
        mockRekeyedScan.mockReturnValue({
            rekeyed: [
                {
                    kind: 'rekeyed',
                    address: 'REKEYED_A',
                    authAccount: {
                        address: 'AAA111',
                        publicKey: new Uint8Array([1]),
                        accountIndex: 0,
                    },
                },
            ],
            isScanning: false,
        })
        mockAllAccounts.mockReturnValue([
            { address: 'REKEYED_A', type: 'watch' },
        ])

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.alreadyImportedAddresses.has('REKEYED_A')).toBe(
            true,
        )
        expect(result.current.upgradeableAddresses.has('REKEYED_A')).toBe(false)
    })

    it('does not report areAllImported while a watch upgrade is still actionable', () => {
        mockAllAccounts.mockReturnValue([
            { address: 'AAA111', type: 'watch' },
            { address: 'BBB222', type: 'hardware' },
        ])

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        expect(result.current.areAllImported).toBe(false)
        act(() => {
            result.current.handleContinue()
        })
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
    })

    it('does not double-include the auth account when it is also explicitly selected', () => {
        const auth = {
            address: 'AAA111',
            publicKey: new Uint8Array([1]),
            accountIndex: 0,
        }
        mockRekeyedScan.mockReturnValue({
            rekeyed: [
                { kind: 'rekeyed', address: 'REKEYED_A', authAccount: auth },
            ],
            isScanning: false,
        })

        const { result } = renderHook(() => useLedgerSelectAccountsScreen())

        act(() => {
            result.current.toggleSelection('REKEYED_A')
        })
        act(() => {
            result.current.toggleSelection('AAA111')
        })
        act(() => {
            result.current.handleContinue()
        })

        const arg = mockNavigate.mock.calls.find(
            c => c[0] === 'LedgerVerify',
        )?.[1] as { selectedAccounts: unknown[] }
        const authDerivedCount = arg.selectedAccounts.filter(
            (s: unknown) =>
                (s as { kind: string; account?: { address: string } }).kind ===
                    'derived' &&
                (s as { account: { address: string } }).account.address ===
                    'AAA111',
        ).length
        expect(authDerivedCount).toBe(1)
        expect(
            arg.selectedAccounts.some(
                (s: unknown) =>
                    (s as { kind: string; address?: string }).kind ===
                        'rekeyed' &&
                    (s as { address: string }).address === 'REKEYED_A',
            ),
        ).toBe(true)
    })
})
