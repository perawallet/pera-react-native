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
import { PinSecurityPrompt } from '../PinSecurityPrompt'
import { usePinSecurityPrompt } from '../usePinSecurityPrompt'
import { useLanguage } from '@hooks/useLanguage'

vi.mock('../usePinSecurityPrompt', () => ({
    usePinSecurityPrompt: vi.fn(),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        header: {},
        dontAskButton: {},
        content: {},
        title: {},
        description: {},
        buttonContainer: {},
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

vi.mock('@assets/images/lock.webp', () => ({
    default: 'mock-lock-image',
}))

describe('PinSecurityPrompt', () => {
    const mockHandleSetPinCode = vi.fn()
    const mockHandleNotNow = vi.fn()
    const mockHandleDontAskAgain = vi.fn()
    const mockOnDismiss = vi.fn()
    const mockOnHide = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(usePinSecurityPrompt as Mock).mockReturnValue({
            handleSetPinCode: mockHandleSetPinCode,
            handleNotNow: mockHandleNotNow,
            handleDontAskAgain: mockHandleDontAskAgain,
        })
        ;(useLanguage as Mock).mockReturnValue({
            t: (key: string) => {
                const translations: Record<string, string> = {
                    'prompts.security.pin_title': 'Set Up Your PIN',
                    'prompts.security.pin_description':
                        'Add extra security to your wallet',
                    'prompts.security.pin_setpin': 'Set PIN',
                    'prompts.security.pin_notnow': 'Not Now',
                    'prompts.security.pin_dont_ask_again': "Don't Ask Again",
                }
                return translations[key] || key
            },
        })
    })

    it('should render the prompt with all elements', () => {
        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        expect(screen.getByText('Set Up Your PIN')).toBeTruthy()
        expect(
            screen.getByText('Add extra security to your wallet'),
        ).toBeTruthy()
        expect(screen.getByText('Set PIN')).toBeTruthy()
        expect(screen.getByText('Not Now')).toBeTruthy()
        expect(screen.getByText("Don't Ask Again")).toBeTruthy()
    })

    it('should call handleSetPinCode when Set PIN button is clicked', () => {
        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        fireEvent.click(screen.getByText('Set PIN'))
        expect(mockHandleSetPinCode).toHaveBeenCalledTimes(1)
    })

    it('should call handleNotNow when Not Now button is clicked', () => {
        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        fireEvent.click(screen.getByText('Not Now'))
        expect(mockHandleNotNow).toHaveBeenCalledTimes(1)
    })

    it("should call handleDontAskAgain when Don't Ask Again is clicked", () => {
        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        fireEvent.click(screen.getByText("Don't Ask Again"))
        expect(mockHandleDontAskAgain).toHaveBeenCalledTimes(1)
    })

    it('should pass props to usePinSecurityPrompt hook', () => {
        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        expect(usePinSecurityPrompt).toHaveBeenCalledWith({
            onDismiss: mockOnDismiss,
            onHide: mockOnHide,
        })
    })

    it('should use translations from useLanguage hook', () => {
        const customTranslations: Record<string, string> = {
            'prompts.security.pin_title': 'Custom Title',
            'prompts.security.pin_description': 'Custom Description',
            'prompts.security.pin_setpin': 'Custom Set PIN',
            'prompts.security.pin_notnow': 'Custom Not Now',
            'prompts.security.pin_dont_ask_again': 'Custom Dismiss',
        }

        ;(useLanguage as Mock).mockReturnValue({
            t: (key: string) => customTranslations[key] || key,
        })

        render(
            <PinSecurityPrompt
                onDismiss={mockOnDismiss}
                onHide={mockOnHide}
            />,
        )

        expect(screen.getByText('Custom Title')).toBeTruthy()
        expect(screen.getByText('Custom Description')).toBeTruthy()
        expect(screen.getByText('Custom Set PIN')).toBeTruthy()
        expect(screen.getByText('Custom Not Now')).toBeTruthy()
        expect(screen.getByText('Custom Dismiss')).toBeTruthy()
    })
})
