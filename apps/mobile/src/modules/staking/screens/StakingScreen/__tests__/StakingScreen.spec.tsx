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
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StakingScreen } from '../StakingScreen'

const mockUseStakingScreen = vi.hoisted(() => vi.fn())

vi.mock('../useStakingScreen', () => ({
    useStakingScreen: mockUseStakingScreen,
}))

type MockCardProps = {
    project: { title: string }
    onPress: (project: unknown) => void
}

type MockSheetProps = {
    isVisible: boolean
}

vi.mock('@modules/staking/components', () => ({
    StakingProjectCard: ({ project, onPress }: MockCardProps) => (
        <button onClick={() => onPress(project)}>{project.title}</button>
    ),
    StakingHelpSheet: ({ isVisible }: MockSheetProps) =>
        isVisible ? <div data-testid='staking-help-sheet' /> : null,
    StakingDisclaimerSheet: ({ isVisible }: MockSheetProps) =>
        isVisible ? <div data-testid='staking-disclaimer-sheet' /> : null,
}))

describe('StakingScreen', () => {
    const baseState = {
        projects: [],
        isLoading: false,
        isError: false,
        error: null,
        isHelpVisible: false,
        isDisclaimerVisible: false,
        handleBack: vi.fn(),
        handleRetry: vi.fn(),
        handleProjectPress: vi.fn(),
        handleHelpOpen: vi.fn(),
        handleHelpClose: vi.fn(),
        handleDisclaimerAccept: vi.fn(),
        handleDisclaimerClose: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseStakingScreen.mockReturnValue(baseState)
    })

    it('renders loading skeletons while projects are loading', () => {
        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            isLoading: true,
        })

        render(<StakingScreen />)

        expect(screen.getAllByTestId('staking-skeleton')).toHaveLength(5)
    })

    it('shows error state and retries when retry is pressed', () => {
        const handleRetry = vi.fn()

        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            isError: true,
            handleRetry,
        })

        render(<StakingScreen />)

        fireEvent.click(screen.getByText('Retry'))

        expect(handleRetry).toHaveBeenCalledTimes(1)
    })

    it('handles toolbar actions', () => {
        const handleBack = vi.fn()
        const handleHelpOpen = vi.fn()

        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            handleBack,
            handleHelpOpen,
        })

        render(<StakingScreen />)

        fireEvent.click(screen.getByTestId('staking-back-button'))
        fireEvent.click(screen.getByTestId('staking-help-button'))

        expect(handleBack).toHaveBeenCalledTimes(1)
        expect(handleHelpOpen).toHaveBeenCalledTimes(1)
    })

    it('renders projects and forwards project press action', () => {
        const handleProjectPress = vi.fn()
        const project = {
            id: 'folks',
            title: 'Folks Finance',
            description: 'Description',
            logoUrl: 'https://example.com/logo.png',
            link: 'https://app.folks.finance',
            type: 'liquid',
            tvlInAlgo: new Decimal(100),
            tvlInUsd: new Decimal(120),
        }

        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            projects: [project],
            handleProjectPress,
        })

        render(<StakingScreen />)

        fireEvent.click(screen.getByText('Folks Finance'))

        expect(handleProjectPress).toHaveBeenCalledWith(project)
    })
})
