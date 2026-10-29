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

const {
    mockDiscover,
    mockNavigate,
    mockReplace,
    mockGoBack,
    mockSheetRequest,
    mockSheetDismiss,
    mockFetchAccountExists,
    routeParams,
} = vi.hoisted(() => ({
    mockDiscover: vi.fn(),
    mockNavigate: vi.fn(),
    mockReplace: vi.fn(),
    mockGoBack: vi.fn(),
    mockSheetRequest: vi.fn(),
    mockSheetDismiss: vi.fn(),
    mockFetchAccountExists: vi.fn(),
    routeParams: {} as Record<string, unknown>,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
        goBack: mockGoBack,
    }),
}))
vi.mock('@hooks/useLanguage')
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
vi.mock('@perawallet/wallet-core-accounts', () => ({
    fetchAccountExistsOn: mockFetchAccountExists,
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))
vi.mock('@modules/ledger/utils', async () => ({
    ...(await vi.importActual<
        typeof import('../../../utils/serializedLedgerAccounts')
    >('../../../utils/serializedLedgerAccounts')),
    ...(await vi.importActual<
        typeof import('../../../utils/requireLedgerProvider')
    >('../../../utils/requireLedgerProvider')),
    getLedgerErrorPreset: (_error: unknown, _t: unknown, appName: string) => ({
        title: 't',
        body: appName,
    }),
}))
vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams }),
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
    for (const key of Object.keys(routeParams)) delete routeParams[key]
    Object.assign(routeParams, {
        deviceId: 'device-1',
        deviceName: 'Nano X',
        transportType: 'ble',
    })
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
        expect(mockDiscover.mock.calls[0][0]).toMatchObject({
            chainId: 'algorand',
        })
        expect(mockReplace).toHaveBeenCalledWith('LedgerSelectAccounts', {
            chainId: 'algorand',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
            accounts: [
                { address: 'LEDGER0', publicKeyHex: '00', accountIndex: 0 },
            ],
        })
        expect(mockFetchAccountExists).toHaveBeenCalledWith('PROBE_ADDR', {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(mockSheetRequest).toHaveBeenCalledTimes(1)
    })

    it("discovers on the route's chain, probes that chain and carries it to the select screen", async () => {
        routeParams.chainId = 'ethereum'
        const transport = buildTransport()
        mockDiscover.mockImplementation(async (opts: DiscoverOptions) => {
            await opts.isAccountOnChain('0xprobe')
            return { accounts: [account(0, '0xledger')], transport }
        })

        renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
        expect(mockDiscover.mock.calls[0][0]).toMatchObject({
            chainId: 'ethereum',
        })
        expect(mockFetchAccountExists).toHaveBeenCalledWith('0xprobe', {
            chainId: 'ethereum',
            networkId: 'mainnet',
        })
        expect(mockReplace.mock.calls[0][1]).toMatchObject({
            chainId: 'ethereum',
        })
    })

    it("hands discovery a probe that rejects when the chain's can't be reached, so it falls back to a capped scan", async () => {
        routeParams.chainId = 'ethereum'
        const failure = new Error('rpc down')
        mockFetchAccountExists.mockRejectedValue(failure)
        mockDiscover.mockReturnValue(new Promise(() => {}))

        renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(mockDiscover).toHaveBeenCalled())
        const { isAccountOnChain } = mockDiscover.mock
            .calls[0][0] as DiscoverOptions
        await expect(isAccountOnChain('0xprobe')).rejects.toBe(failure)
    })

    it("names the chain's app in an error", async () => {
        routeParams.chainId = 'ethereum'
        mockDiscover.mockRejectedValue(new Error('locked'))

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(result.current.errorPreset).not.toBeNull())
        expect(result.current.errorPreset?.body).toBe('Ethereum')
    })

    it('stays connecting, with the device name, until discovery reports progress', async () => {
        mockDiscover.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => expect(mockDiscover).toHaveBeenCalled())
        expect(result.current.connectionStatus).toBe('connecting')
        expect(result.current.isDiscovering).toBe(false)
        expect(result.current.deviceName).toBe('Nano X')
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
