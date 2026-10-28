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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRoute } from '@react-navigation/native'

import { useLedgerInstructionsScreen } from '../useLedgerInstructionsScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    errorToast: vi.fn(),
    requestPermissions: vi.fn(),
    hasPermissions: false,
    isChecking: false,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('../../../hooks', async importOriginal => ({
    ...(await importOriginal<object>()),
    useBlePermissions: () => ({
        hasPermissions: mocks.hasPermissions,
        isChecking: mocks.isChecking,
        requestPermissions: mocks.requestPermissions,
    }),
}))

vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    ledgerAppNameFor: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))

const setTransport = (
    transportType?: 'ble' | 'usb',
    chainId?: string,
): void => {
    const params = {
        ...(transportType ? { transportType } : {}),
        ...(chainId ? { chainId } : {}),
    }
    vi.mocked(useRoute).mockReturnValue({
        key: 'LedgerInstructions',
        name: 'LedgerInstructions',
        params: Object.keys(params).length > 0 ? params : undefined,
    })
}

const continueAndSettle = async (handleContinue: () => void): Promise<void> => {
    await act(async () => {
        handleContinue()
        await Promise.resolve()
    })
}

describe('useLedgerInstructionsScreen', () => {
    beforeEach(() => {
        mocks.hasPermissions = false
        mocks.isChecking = false
        mocks.requestPermissions.mockResolvedValue(true)
        setTransport()
    })

    it('defaults to Bluetooth when no transport is given', () => {
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        expect(result.current.transportType).toBe('ble')
    })

    it("names the route chain's app and scans on that chain", async () => {
        setTransport('usb', 'ethereum')
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        expect(result.current.appName).toBe('Ethereum')
        await continueAndSettle(result.current.handleContinue)
        expect(mocks.navigate).toHaveBeenCalledWith('LedgerScan', {
            transportType: 'usb',
            chainId: 'ethereum',
        })
    })

    it("names the first Ledger chain's app when the route names none", () => {
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        expect(result.current.appName).toBe('Algorand')
    })

    it('reports the permission check in progress', () => {
        mocks.isChecking = true

        const { result } = renderHook(() => useLedgerInstructionsScreen())

        expect(result.current.isChecking).toBe(true)
    })

    it('goes straight to scanning over USB without asking for Bluetooth', async () => {
        setTransport('usb')
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        await continueAndSettle(result.current.handleContinue)

        expect(mocks.requestPermissions).not.toHaveBeenCalled()
        expect(mocks.navigate).toHaveBeenCalledWith('LedgerScan', {
            transportType: 'usb',
            chainId: 'algorand',
        })
    })

    it('goes straight to scanning when Bluetooth is already permitted', async () => {
        mocks.hasPermissions = true
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        await continueAndSettle(result.current.handleContinue)

        expect(mocks.requestPermissions).not.toHaveBeenCalled()
        expect(mocks.navigate).toHaveBeenCalledWith('LedgerScan', {
            transportType: 'ble',
            chainId: 'algorand',
        })
    })

    it('asks for Bluetooth and scans once granted', async () => {
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        await continueAndSettle(result.current.handleContinue)

        expect(mocks.requestPermissions).toHaveBeenCalledTimes(1)
        expect(mocks.navigate).toHaveBeenCalledWith('LedgerScan', {
            transportType: 'ble',
            chainId: 'algorand',
        })
    })

    it('stays put and explains when Bluetooth permission is refused', async () => {
        mocks.requestPermissions.mockResolvedValue(false)
        const { result } = renderHook(() => useLedgerInstructionsScreen())

        await continueAndSettle(result.current.handleContinue)

        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            'ledger.instructions.permission_required_title',
            'ledger.instructions.permission_required_message',
        )
    })
})
