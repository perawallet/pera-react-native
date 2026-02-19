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

import { describe, it, expect, vi } from 'vitest'
import { render } from '@test-utils/render'
import { TransactionProcessingScreen } from '../TransactionProcessingScreen'

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
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        title: {},
        subtitle: {},
    }),
}))

vi.mock('../useTransactionProcessingScreen', () => ({
    useTransactionProcessingScreen: vi.fn(),
}))

vi.mock('react-native', () => ({
    ActivityIndicator: (props: { size: string; color: string }) => (
        <div
            data-testid='activity-indicator'
            data-size={props.size}
            data-color={props.color}
        />
    ),
}))

describe('TransactionProcessingScreen', () => {
    it('renders ActivityIndicator', () => {
        const { getByTestId } = render(<TransactionProcessingScreen />)

        expect(getByTestId('activity-indicator')).toBeTruthy()
    })

    it('renders title text', () => {
        const { getByText } = render(<TransactionProcessingScreen />)

        expect(getByText('send_funds.processing.title')).toBeTruthy()
    })

    it('renders subtitle text', () => {
        const { getByText } = render(<TransactionProcessingScreen />)

        expect(getByText('send_funds.processing.subtitle')).toBeTruthy()
    })
})
