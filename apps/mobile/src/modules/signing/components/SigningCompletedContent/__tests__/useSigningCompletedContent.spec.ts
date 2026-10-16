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

import { Linking } from 'react-native'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSigningCompletedContent } from '../useSigningCompletedContent'

const mockResolve = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve, dismiss: vi.fn() }),
}))

describe('useSigningCompletedContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('hides the return CTA when the session has no browser origin', () => {
        const { result } = renderHook(() => useSigningCompletedContent())

        expect(result.current.showReturnCta).toBe(false)
    })

    it('hides the return CTA when the browser has no focus scheme (iOS Safari)', () => {
        const { result } = renderHook(() =>
            useSigningCompletedContent({ browserName: 'Mobile Safari' }),
        )

        expect(result.current.showReturnCta).toBe(false)
    })

    it('focuses the originating browser and resolves the sheet on return', () => {
        vi.mocked(Linking.openURL).mockResolvedValue(true)
        const { result } = renderHook(() =>
            useSigningCompletedContent({
                browserName: 'Chrome',
                dappName: 'TestDApp',
            }),
        )

        expect(result.current.showReturnCta).toBe(true)
        result.current.handleReturnToDapp()

        expect(Linking.openURL).toHaveBeenCalledWith('googlechrome://')
        expect(mockResolve).toHaveBeenCalledWith(true)
    })

    it('names the dApp in the return label when known, else uses the generic label', () => {
        const named = renderHook(() =>
            useSigningCompletedContent({
                browserName: 'Chrome',
                dappName: 'TestDApp',
            }),
        )
        const generic = renderHook(() =>
            useSigningCompletedContent({ browserName: 'Chrome' }),
        )

        expect(named.result.current.returnLabel).toBe(
            'walletconnect.request.success_sheet_return_to_dapp',
        )
        expect(generic.result.current.returnLabel).toBe(
            'walletconnect.request.success_sheet_return_to_dapp_generic',
        )
    })
})
