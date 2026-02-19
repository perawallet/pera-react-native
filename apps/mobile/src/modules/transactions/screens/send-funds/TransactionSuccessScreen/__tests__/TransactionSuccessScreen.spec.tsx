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
import { render, fireEvent } from '@test-utils/render'
import { TransactionSuccessScreen } from '../TransactionSuccessScreen'
import { useTransactionSuccessScreen } from '../useTransactionSuccessScreen'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style, ...rest }: any) => (
        <div
            style={style}
            {...rest}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, variant, ...rest }: any) => (
        <span
            data-variant={variant}
            {...rest}
        >
            {children}
        </span>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWIcon: ({ name, variant }: any) => (
        <div data-testid={`icon-${name}`} data-variant={variant} />
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        content: {},
        iconCircle: {},
        title: {},
        subtitle: {},
        footer: {},
    }),
}))

vi.mock('../useTransactionSuccessScreen', () => ({
    useTransactionSuccessScreen: vi.fn(),
}))

const mockHandleDone = vi.fn()
const mockHandleViewInExplorer = vi.fn()

describe('TransactionSuccessScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useTransactionSuccessScreen as any).mockReturnValue({
            handleDone: mockHandleDone,
            handleViewInExplorer: mockHandleViewInExplorer,
        })
    })

    it('renders check icon', () => {
        const { getByTestId } = render(<TransactionSuccessScreen />)

        expect(getByTestId('icon-check')).toBeTruthy()
    })

    it('renders title text', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        expect(getByText('send_funds.success.title')).toBeTruthy()
    })

    it('renders subtitle text', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        expect(getByText('send_funds.success.subtitle')).toBeTruthy()
    })

    it('renders explorer link button', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        expect(getByText('send_funds.success.view_in_explorer')).toBeTruthy()
    })

    it('renders Done button', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        expect(getByText('send_funds.success.done')).toBeTruthy()
    })

    it('calls handleViewInExplorer when explorer link is pressed', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        fireEvent.click(getByText('send_funds.success.view_in_explorer'))

        expect(mockHandleViewInExplorer).toHaveBeenCalledTimes(1)
    })

    it('calls handleDone when Done button is pressed', () => {
        const { getByText } = render(<TransactionSuccessScreen />)

        fireEvent.click(getByText('send_funds.success.done'))

        expect(mockHandleDone).toHaveBeenCalledTimes(1)
    })
})
