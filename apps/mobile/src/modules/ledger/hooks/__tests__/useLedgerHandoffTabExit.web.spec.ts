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
import { renderHook } from '@testing-library/react'

const { consumedFlow, mockCloseCurrentTab } = vi.hoisted(() => ({
    consumedFlow: { current: 'ledger-usb' as string | null },
    mockCloseCurrentTab: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    closeCurrentTab: () => mockCloseCurrentTab(),
    getConsumedExpandedFlow: () => consumedFlow.current,
}))

import { useLedgerHandoffTabExit } from '../useLedgerHandoffTabExit.web'

describe('useLedgerHandoffTabExit', () => {
    beforeEach(() => {
        consumedFlow.current = 'ledger-usb'
        mockCloseCurrentTab.mockReset()
    })

    it('closes the pairing tab once navigation leaves the Ledger screens', () => {
        const { result } = renderHook(() => useLedgerHandoffTabExit())

        result.current('LedgerScan')
        result.current('LedgerFetchAccounts')
        expect(mockCloseCurrentTab).not.toHaveBeenCalled()

        result.current('Home')
        expect(mockCloseCurrentTab).toHaveBeenCalledTimes(1)
    })

    it('ignores the initial state reported before the Ledger screens open', () => {
        const { result } = renderHook(() => useLedgerHandoffTabExit())

        result.current('Home')

        expect(mockCloseCurrentTab).not.toHaveBeenCalled()
    })

    it('never closes a tab that was not opened for Ledger pairing', () => {
        consumedFlow.current = 'scan'
        const { result } = renderHook(() => useLedgerHandoffTabExit())

        result.current('LedgerScan')
        result.current('Home')

        expect(mockCloseCurrentTab).not.toHaveBeenCalled()
    })
})
