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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { SendFundsInfoPanel } from '../SendFundsInfoPanel'
import { useSendFundsInfoPanel } from '../useSendFundsInfoPanel'

const mockHandleOpenInfoLink = vi.fn()
const mockHandleClose = vi.fn()

vi.mock('../useSendFundsInfoPanel', () => ({
    useSendFundsInfoPanel: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('react-i18next', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Trans: ({ i18nKey, components }: any) => (
        <span>
            {i18nKey}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {components?.map((c: any, i: number) => (
                <span
                    key={i}
                    onClick={c.props?.onPress}
                    data-testid={`trans-component-${i}`}
                >
                    link
                </span>
            ))}
        </span>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({}),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: ({ children, isVisible }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ onPress, title }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, onPress }: any) =>
        onPress ? (
            <span onClick={onPress}>{children}</span>
        ) : (
            <span>{children}</span>
        ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWIcon: ({ name }: any) => <div data-testid={`icon-${name}`} />,
}))

describe('SendFundsInfoPanel', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsInfoPanel as any).mockReturnValue({
            forceOpen: false,
            handleOpenInfoLink: mockHandleOpenInfoLink,
            handleClose: mockHandleClose,
        })
    })

    it('renders content when isVisible is true', () => {
        render(
            <SendFundsInfoPanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByText('send_funds.info.title')).toBeTruthy()
    })

    it('renders content when forceOpen is true even if isVisible is false', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsInfoPanel as any).mockReturnValue({
            forceOpen: true,
            handleOpenInfoLink: mockHandleOpenInfoLink,
            handleClose: mockHandleClose,
        })

        render(
            <SendFundsInfoPanel
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByText('send_funds.info.title')).toBeTruthy()
    })

    it('does not render content when both isVisible and forceOpen are false', () => {
        render(
            <SendFundsInfoPanel
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('bottom-sheet')).toBeNull()
    })

    it('calls handleClose when "I understand" button is pressed', () => {
        render(
            <SendFundsInfoPanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByText('send_funds.info.i_understand'))

        expect(mockHandleClose).toHaveBeenCalledTimes(1)
    })

    it('calls handleOpenInfoLink when "tap here" link is pressed', () => {
        render(
            <SendFundsInfoPanel
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByTestId('trans-component-0'))

        expect(mockHandleOpenInfoLink).toHaveBeenCalledTimes(1)
    })
})
