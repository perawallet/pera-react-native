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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi } from 'vitest'
import { StakingDisclaimerSheet } from '../StakingDisclaimerSheet'

const mockUseStakingDisclaimerSheet = vi.hoisted(() => vi.fn())

vi.mock('../useStakingDisclaimerSheet', () => ({
    useStakingDisclaimerSheet: mockUseStakingDisclaimerSheet,
}))

describe('StakingDisclaimerSheet', () => {
    it('keeps accept action disabled until user reaches the bottom', () => {
        const onAccept = vi.fn()
        const baseHookState = {
            isScrolledToBottom: false,
            handleScroll: vi.fn(),
        }

        mockUseStakingDisclaimerSheet.mockReturnValue(baseHookState)

        const { rerender } = render(
            <StakingDisclaimerSheet
                isVisible={true}
                onAccept={onAccept}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByText('staking.disclaimer.accept'))
        expect(onAccept).not.toHaveBeenCalled()

        mockUseStakingDisclaimerSheet.mockReturnValue({
            ...baseHookState,
            isScrolledToBottom: true,
        })
        rerender(
            <StakingDisclaimerSheet
                isVisible={true}
                onAccept={onAccept}
                onClose={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByText('staking.disclaimer.accept'))
        expect(onAccept).toHaveBeenCalledTimes(1)
    })
})
