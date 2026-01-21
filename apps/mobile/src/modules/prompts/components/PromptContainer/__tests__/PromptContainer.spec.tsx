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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { PromptContainer } from '../PromptContainer'
import { usePromptContainer } from '../usePromptContainer'

vi.mock('../usePromptContainer', () => ({
    usePromptContainer: vi.fn(),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        modal: {},
        container: {},
    }),
}))

vi.mock('react-native-safe-area-context', () => {
    const inset = { top: 0, right: 0, bottom: 0, left: 0 }
    return {
        SafeAreaProvider: vi
            .fn()
            .mockImplementation(({ children }) => children),
        SafeAreaConsumer: vi
            .fn()
            .mockImplementation(({ children }) => children(inset)),
        useSafeAreaInsets: vi.fn().mockImplementation(() => inset),
        SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    }
})

describe('PromptContainer', () => {
    const mockDismissPrompt = vi.fn()
    const mockHidePrompt = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render null when there is no nextPrompt', () => {
        ;(usePromptContainer as Mock).mockReturnValue({
            nextPrompt: undefined,
            dismissPrompt: mockDismissPrompt,
            hidePrompt: mockHidePrompt,
        })

        const { container } = render(<PromptContainer />)
        expect(container.firstChild).toBeNull()
    })

    it('should render the prompt component when nextPrompt is available', () => {
        const MockPromptComponent = () => (
            <div data-testid='mock-prompt'>Mock Prompt</div>
        )

        ;(usePromptContainer as Mock).mockReturnValue({
            nextPrompt: {
                id: 'test-prompt',
                component: MockPromptComponent,
            },
            dismissPrompt: mockDismissPrompt,
            hidePrompt: mockHidePrompt,
        })

        render(<PromptContainer />)
        expect(screen.getByTestId('mock-prompt')).toBeTruthy()
    })

    it('should call dismissPrompt with the prompt id when onDismiss is triggered', () => {
        const MockPromptComponent = ({
            onDismiss,
        }: {
            onDismiss: () => void
            onHide: () => void
        }) => (
            <button
                data-testid='dismiss-button'
                onClick={onDismiss}
            >
                Dismiss
            </button>
        )

        ;(usePromptContainer as Mock).mockReturnValue({
            nextPrompt: {
                id: 'test-prompt-id',
                component: MockPromptComponent,
            },
            dismissPrompt: mockDismissPrompt,
            hidePrompt: mockHidePrompt,
        })

        render(<PromptContainer />)
        fireEvent.click(screen.getByTestId('dismiss-button'))

        expect(mockDismissPrompt).toHaveBeenCalledWith('test-prompt-id')
    })

    it('should call hidePrompt with the prompt id when onHide is triggered', () => {
        const MockPromptComponent = ({
            onHide,
        }: {
            onDismiss: () => void
            onHide: () => void
        }) => (
            <button
                data-testid='hide-button'
                onClick={onHide}
            >
                Hide
            </button>
        )

        ;(usePromptContainer as Mock).mockReturnValue({
            nextPrompt: {
                id: 'test-prompt-id',
                component: MockPromptComponent,
            },
            dismissPrompt: mockDismissPrompt,
            hidePrompt: mockHidePrompt,
        })

        render(<PromptContainer />)
        fireEvent.click(screen.getByTestId('hide-button'))

        expect(mockHidePrompt).toHaveBeenCalledWith('test-prompt-id')
    })

    it('should handle empty prompt id gracefully', () => {
        const MockPromptComponent = ({
            onDismiss,
        }: {
            onDismiss: () => void
            onHide: () => void
        }) => (
            <button
                data-testid='dismiss-button'
                onClick={onDismiss}
            >
                Dismiss
            </button>
        )

        ;(usePromptContainer as Mock).mockReturnValue({
            nextPrompt: {
                id: '',
                component: MockPromptComponent,
            },
            dismissPrompt: mockDismissPrompt,
            hidePrompt: mockHidePrompt,
        })

        render(<PromptContainer />)
        fireEvent.click(screen.getByTestId('dismiss-button'))

        expect(mockDismissPrompt).toHaveBeenCalledWith('')
    })
})
