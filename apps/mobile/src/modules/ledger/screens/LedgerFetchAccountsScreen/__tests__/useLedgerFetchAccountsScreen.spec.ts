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

// This screen hook had no spec at all (LRK-022 unit gap): it owns the
// connect→discover→select handoff, the connecting sheet, and error retry.

const {
    mockDiscover,
    mockNavigate,
    mockReplace,
    mockGoBack,
    mockSheetRequest,
    mockSheetDismiss,
    mockFetchAccountExists,
} = vi.hoisted(() => ({
    mockDiscover: vi.fn(),
    mockNavigate: vi.fn(),
    mockReplace: vi.fn(),
    mockGoBack: vi.fn(),
    mockSheetRequest: vi.fn(),
    mockSheetDismiss: vi.fn(),
    mockFetchAccountExists: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
        goBack: mockGoBack,
    }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockSheetRequest,
        dismiss: mockSheetDismiss,
    }),
}))
vi.mock('../../../components/LedgerConnectingContent', () => ({
    LedgerConnectingContent: () => null,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        hardwareWalletRegistry: {
            getProvider: () => ({ connect: vi.fn() }),
        },
    }),
}))
vi.mock('@perawallet/wallet-core-ledger', () => ({
    connectAndDiscoverAccounts: mockDiscover,
    LedgerNoAccountsFoundError: class extends Error {},
    LedgerProviderNotFoundError: class extends Error {},
    classifyLedgerError: (e: unknown) => e as Error,
}))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    fetchAccountExists: mockFetchAccountExists,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@modules/ledger/utils', async () => ({
    ...(await vi.importActual<
        typeof import('../../../utils/serializedLedgerAccounts')
    >('../../../utils/serializedLedgerAccounts')),
    getLedgerErrorPreset: () => ({ title: 't', body: 'b' }),
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: {
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
    }),
}))

import { useLedgerFetchAccountsScreen } from '../useLedgerFetchAccountsScreen'

const account = (accountIndex: number, address: string) => ({
    address,
    publicKey: new Uint8Array([accountIndex]),
    accountIndex,
})

const buildTransport = () => ({
    disconnect: vi.fn().mockResolvedValue(undefined),
})

type DiscoverOptions = {
    onProgress: (index: number) => void
    isAccountOnChain: (address: string) => Promise<boolean>
}

beforeEach(() => {
    vi.clearAllMocks()
    // The connecting sheet stays open until dismissed — model it as pending.
    mockSheetRequest.mockReturnValue(new Promise(() => {}))
    mockFetchAccountExists.mockResolvedValue(true)
})

describe('useLedgerFetchAccountsScreen', () => {
    it('discovers accounts and replaces to the select screen with serialized route params', async () => {
        const transport = buildTransport()
        mockDiscover.mockImplementation(async (opts: DiscoverOptions) => {
            // Discovery wires the on-chain probe through to the gap scan.
            await opts.isAccountOnChain('PROBE_ADDR')
            return { accounts: [account(0, 'LEDGER0')], transport }
        })

        renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
        expect(mockReplace).toHaveBeenCalledWith('LedgerSelectAccounts', {
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
            accounts: [
                { address: 'LEDGER0', publicKeyHex: '00', accountIndex: 0 },
            ],
        })
        expect(mockFetchAccountExists).toHaveBeenCalledWith(
            'PROBE_ADDR',
            'mainnet',
        )
        expect(mockSheetRequest).toHaveBeenCalledTimes(1)
    })

    it('reports discovery progress while the device probes indices', async () => {
        mockDiscover.mockImplementation((opts: DiscoverOptions) => {
            opts.onProgress(0)
            opts.onProgress(1)
            return new Promise(() => {})
        })

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(result.current.isDiscovering).toBe(true))
        expect(result.current.progress.current).toBe(2)
        expect(result.current.isLoading).toBe(true)
    })

    it('surfaces an error preset when discovery finds no accounts', async () => {
        mockDiscover.mockResolvedValue({
            accounts: [],
            transport: buildTransport(),
        })

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(result.current.errorPreset).toBeTruthy())
        expect(result.current.connectionStatus).toBe('disconnected')
        expect(result.current.isLoading).toBe(false)
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('classifies a connect failure and recovers on retry', async () => {
        mockDiscover
            .mockRejectedValueOnce(new Error('BLE dropped'))
            .mockResolvedValueOnce({
                accounts: [account(0, 'LEDGER0')],
                transport: buildTransport(),
            })

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(result.current.errorPreset).toBeTruthy())

        act(() => {
            result.current.handleRetry()
        })

        await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
        expect(result.current.errorPreset).toBeNull()
    })

    it('navigates back when the connecting sheet resolves as cancelled', async () => {
        mockDiscover.mockReturnValue(new Promise(() => {}))
        mockSheetRequest.mockResolvedValue('cancel')

        renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
    })

    it('disconnects a transport that resolves after unmount and never navigates', async () => {
        const transport = buildTransport()
        let resolveDiscover: (value: unknown) => void = () => {}
        mockDiscover.mockReturnValue(
            new Promise(resolve => {
                resolveDiscover = resolve
            }),
        )

        const { unmount } = renderHook(() => useLedgerFetchAccountsScreen())
        unmount()

        await act(async () => {
            resolveDiscover({ accounts: [account(0, 'LEDGER0')], transport })
        })

        await waitFor(() => expect(transport.disconnect).toHaveBeenCalled())
        expect(mockReplace).not.toHaveBeenCalled()
    })
})
