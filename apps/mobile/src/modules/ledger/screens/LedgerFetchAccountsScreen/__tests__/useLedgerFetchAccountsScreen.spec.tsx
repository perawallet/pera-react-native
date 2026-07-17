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
import { useLedgerFetchAccountsScreen } from '../useLedgerFetchAccountsScreen'

const { mocks } = vi.hoisted(() => ({
    mocks: {
        replace: vi.fn(),
        goBack: vi.fn(),
        navigate: vi.fn(),
        connectAndDiscoverAccounts: vi.fn(),
        requestBottomSheet: vi.fn(() => new Promise(() => {})),
        dismiss: vi.fn(),
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: {
            deviceId: 'device-1',
            deviceName: 'Fred Nano X',
            transportType: 'ble',
        },
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        replace: mocks.replace,
        goBack: mocks.goBack,
        navigate: mocks.navigate,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        hardwareWalletRegistry: {
            getProvider: () => ({ connect: vi.fn() }),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-ledger', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-ledger')
    >()),
    connectAndDiscoverAccounts: mocks.connectAndDiscoverAccounts,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    fetchAccountExists: vi.fn().mockResolvedValue(true),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-blockchain')
    >()),
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.requestBottomSheet,
        dismiss: mocks.dismiss,
    }),
}))

type DiscoverOptions = {
    onProgress: (index: number) => void
}

describe('useLedgerFetchAccountsScreen - connecting state', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requestBottomSheet.mockImplementation(() => new Promise(() => {}))
    })

    it('stays in the connecting state until discovery reports progress', async () => {
        mocks.connectAndDiscoverAccounts.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => {
            expect(mocks.connectAndDiscoverAccounts).toHaveBeenCalled()
        })
        expect(result.current.connectionStatus).toBe('connecting')
        expect(result.current.isDiscovering).toBe(false)
    })

    it('flips to discovering when the first account probe reports progress', async () => {
        mocks.connectAndDiscoverAccounts.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        await waitFor(() => {
            expect(mocks.connectAndDiscoverAccounts).toHaveBeenCalled()
        })
        const options = mocks.connectAndDiscoverAccounts.mock
            .calls[0][0] as DiscoverOptions

        act(() => {
            options.onProgress(0)
        })

        expect(result.current.isDiscovering).toBe(true)
        expect(result.current.progress).toEqual({ current: 1, total: null })
    })

    it('exposes the device name for the connecting copy', () => {
        mocks.connectAndDiscoverAccounts.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLedgerFetchAccountsScreen())

        expect(result.current.deviceName).toBe('Fred Nano X')
    })
})
