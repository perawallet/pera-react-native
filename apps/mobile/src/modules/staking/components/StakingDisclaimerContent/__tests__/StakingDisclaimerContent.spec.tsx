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

import React from 'react'
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { StakingDisclaimerContent } from '../StakingDisclaimerContent'

const mockUseStakingDisclaimerSheet = vi.hoisted(() => vi.fn())

vi.mock('../useStakingDisclaimerContent', () => ({
    useStakingDisclaimerSheet: mockUseStakingDisclaimerSheet,
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { termsOfServiceUrl: 'https://example.com/terms' },
}))

const renderInSheet = () =>
    render(
        <BottomSheetIdContext.Provider value='sheet-1'>
            <StakingDisclaimerContent />
        </BottomSheetIdContext.Provider>,
    )

describe('StakingDisclaimerContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        mockUseStakingDisclaimerSheet.mockReturnValue({
            isScrolledToBottom: false,
            handleScroll: vi.fn(),
        })
    })

    it('keeps accept action disabled until user reaches the bottom', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<boolean>({ id: 'sheet-1', contents: null })
        const { rerender } = renderInSheet()

        fireEvent.click(screen.getByText('staking.disclaimer.accept'))
        // Still pending — accept was disabled
        let settled = false
        promise.then(() => {
            settled = true
        })
        await Promise.resolve()
        expect(settled).toBe(false)

        mockUseStakingDisclaimerSheet.mockReturnValue({
            isScrolledToBottom: true,
            handleScroll: vi.fn(),
        })
        rerender(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <StakingDisclaimerContent />
            </BottomSheetIdContext.Provider>,
        )

        fireEvent.click(screen.getByText('staking.disclaimer.accept'))
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe(true)
    })
})
