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
const mockSetOptions = vi.hoisted(() => vi.fn())

vi.mock('../useStakingScreen', () => ({
    useStakingScreen: mockUseStakingScreen,
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<
        typeof import('@react-navigation/native')
    >('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            navigate: vi.fn(),
            goBack: vi.fn(),
            reset: vi.fn(),
            setOptions: mockSetOptions,
            push: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            isFocused: vi.fn(() => true),
        }),
    }
})

type MockCardProps = {
    project: { title: string }
    onPress: (project: unknown) => void
}

type MockSheetProps = {
    isVisible: boolean
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/staking/components', () => ({
    StakingProjectCard: ({ project, onPress }: MockCardProps) => (
        <button onClick={() => onPress(project)}>{project.title}</button>
    ),
    StakingHelpSheet: ({ isVisible }: MockSheetProps) =>
        isVisible ? <div data-testid='staking-help-sheet' /> : null,
    StakingDisclaimerSheet: ({ isVisible }: MockSheetProps) =>
        isVisible ? <div data-testid='staking-disclaimer-sheet' /> : null,
    StakingErrorBoundary: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
}))

describe('StakingScreen', () => {
    const baseState = {
        projects: [],
        isLoading: false,
        isError: false,
        isHelpVisible: false,
        isDisclaimerVisible: false,
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

        fireEvent.click(screen.getByText('staking.retry'))

        expect(handleRetry).toHaveBeenCalledTimes(1)
    })

    it('sets up header right button that opens help', () => {
        const handleHelpOpen = vi.fn()

        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            handleHelpOpen,
        })

        render(<StakingScreen />)

        const setOptionsCall = mockSetOptions.mock.calls[0]?.[0] as {
            headerRight?: () => React.ReactNode
        }

        expect(setOptionsCall?.headerRight).toBeDefined()

        render(setOptionsCall.headerRight!() as React.ReactElement)

        fireEvent.click(screen.getByTestId('staking-help-button'))

        expect(handleHelpOpen).toHaveBeenCalledTimes(1)
    })

    it('renders empty view when there are no projects to show', () => {
        mockUseStakingScreen.mockReturnValue({
            ...baseState,
            projects: [],
        })

        render(<StakingScreen />)

        expect(screen.getByTestId('staking-empty-view')).toBeTruthy()
        expect(screen.queryByTestId('staking-projects-list')).toBeNull()
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
