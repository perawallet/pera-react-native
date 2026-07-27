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
import { renderHook } from '@testing-library/react'

const { surfaceState, mockOpenExpandedTab } = vi.hoisted(() => ({
    surfaceState: { current: 'popup' as 'popup' | 'expanded' },
    mockOpenExpandedTab: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => surfaceState.current,
    openExpandedTab: (flow: string) => mockOpenExpandedTab(flow),
}))

import { useLedgerExpandedTabHandoff } from '../useLedgerExpandedTabHandoff.web'

describe('useLedgerExpandedTabHandoff (web)', () => {
    beforeEach(() => {
        surfaceState.current = 'popup'
        mockOpenExpandedTab.mockReset()
    })

    it('reports isPopupSurface true in the popup', () => {
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())
        expect(result.current.isPopupSurface).toBe(true)
    })

    it('reports isPopupSurface false in the expanded tab', () => {
        surfaceState.current = 'expanded'
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())
        expect(result.current.isPopupSurface).toBe(false)
    })

    it('opens the ledger-usb flow for a USB transport', async () => {
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())
        await result.current.openLedgerExpandedTab('usb')
        expect(mockOpenExpandedTab).toHaveBeenCalledWith('ledger-usb')
    })

    it('opens the ledger-ble flow for a BLE transport', async () => {
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())
        await result.current.openLedgerExpandedTab('ble')
        expect(mockOpenExpandedTab).toHaveBeenCalledWith('ledger-ble')
    })
})
