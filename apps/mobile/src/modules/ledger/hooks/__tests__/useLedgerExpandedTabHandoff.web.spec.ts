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

const {
    surfaceState,
    mockOpenExpandedTab,
    mockPutTabResumeIntent,
    consumedFlow,
    resumeIntent,
} = vi.hoisted(() => ({
    surfaceState: { current: 'popup' as 'popup' | 'expanded' },
    mockOpenExpandedTab: vi.fn(),
    mockPutTabResumeIntent: vi.fn(),
    consumedFlow: { current: null as string | null },
    resumeIntent: { current: null as Record<string, unknown> | null },
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => surfaceState.current,
}))
vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    openExpandedTab: (flow: string) => mockOpenExpandedTab(flow),
    closeCurrentTab: vi.fn(),
    getConsumedExpandedFlow: () => consumedFlow.current,
    putTabResumeIntent: (intent: unknown) => mockPutTabResumeIntent(intent),
}))
// vitest doesn't resolve `.web.ts` twins; stand in for the web registry.
vi.mock('@utils/tabResumeIntent', () => ({
    peekTabResumeIntent: () => resumeIntent.current,
}))

import { useLedgerExpandedTabHandoff } from '../useLedgerExpandedTabHandoff.web'

describe('useLedgerExpandedTabHandoff (web)', () => {
    beforeEach(() => {
        surfaceState.current = 'popup'
        consumedFlow.current = null
        resumeIntent.current = null
        mockOpenExpandedTab.mockReset()
        mockPutTabResumeIntent.mockReset()
    })

    it.each(['ledger-usb', 'ledger-ble'])(
        'reports a hand-off tab when opened for %s',
        flow => {
            consumedFlow.current = flow
            const { result } = renderHook(() => useLedgerExpandedTabHandoff())
            expect(result.current.isHandoffTab).toBe(true)
        },
    )

    it.each([null, 'scan', 'add-account'])(
        'reports no hand-off tab for %s',
        flow => {
            consumedFlow.current = flow
            const { result } = renderHook(() => useLedgerExpandedTabHandoff())
            expect(result.current.isHandoffTab).toBe(false)
        },
    )

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

    it('opens the wallet home when no flow registered anything to resume', async () => {
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())
        await result.current.openWalletInTab()
        expect(mockOpenExpandedTab).toHaveBeenCalledExactlyOnceWith(undefined)
        expect(mockPutTabResumeIntent).not.toHaveBeenCalled()
    })

    it('hands the signing flow to the tab before opening it on the resume flow', async () => {
        resumeIntent.current = { flow: 'swap', accountAddress: 'ADDR' }
        const { result } = renderHook(() => useLedgerExpandedTabHandoff())

        await result.current.openWalletInTab()

        expect(mockPutTabResumeIntent).toHaveBeenCalledWith({
            flow: 'swap',
            accountAddress: 'ADDR',
            createdAt: expect.any(Number),
        })
        expect(mockOpenExpandedTab).toHaveBeenCalledExactlyOnceWith('resume')
        expect(mockPutTabResumeIntent.mock.invocationCallOrder[0]).toBeLessThan(
            mockOpenExpandedTab.mock.invocationCallOrder[0],
        )
    })
})
