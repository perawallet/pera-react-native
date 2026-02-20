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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ARC59WarningBottomSheet } from '../ARC59WarningBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: vi.fn(({ isVisible, children }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: vi.fn(({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    )),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: vi.fn(({ children }: any) => <div>{children}</div>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: vi.fn(({ children }: any) => <span>{children}</span>),
    PWIcon: vi.fn(() => <div />),
}))

describe('ARC59WarningBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders warning content when visible', () => {
        render(<ARC59WarningBottomSheet {...defaultProps} />)

        expect(screen.getByText('send_funds.arc59_warning.title')).toBeTruthy()
        expect(
            screen.getByText('send_funds.arc59_warning.message'),
        ).toBeTruthy()
    })

    it('does not render content when not visible', () => {
        render(
            <ARC59WarningBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByText('send_funds.arc59_warning.title')).toBeNull()
    })

    it('calls onConfirm when confirm button is pressed', () => {
        const onConfirm = vi.fn()
        render(
            <ARC59WarningBottomSheet
                {...defaultProps}
                onConfirm={onConfirm}
            />,
        )

        fireEvent.click(screen.getByText('send_funds.arc59_warning.confirm'))

        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when cancel button is pressed', () => {
        const onClose = vi.fn()
        render(
            <ARC59WarningBottomSheet
                {...defaultProps}
                onClose={onClose}
            />,
        )

        fireEvent.click(screen.getByText('send_funds.arc59_warning.cancel'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
