/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { ChainNotice } from '../ChainNotice'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
    }),
}))

describe('ChainNotice', () => {
    it('renders the title key with its params', () => {
        render(
            <ChainNotice
                kind='warning'
                titleKey='transactions.notice.pending'
                params={{ since: '10:42' }}
            />,
        )

        expect(
            screen.getByText('transactions.notice.pending {"since":"10:42"}'),
        ).toBeTruthy()
    })

    it('shows the warning glyph for a warning', () => {
        render(
            <ChainNotice
                kind='warning'
                titleKey='transactions.notice.replaced'
            />,
        )

        expect(screen.getByTestId('icon-warning')).toBeTruthy()
        expect(screen.queryByTestId('icon-error-circle')).toBeNull()
    })

    it('shows the error glyph for an error', () => {
        render(
            <ChainNotice
                kind='error'
                titleKey='transactions.notice.failed'
            />,
        )

        expect(screen.getByTestId('icon-error-circle')).toBeTruthy()
        expect(screen.queryByTestId('icon-warning')).toBeNull()
    })

    it('renders no action without one', () => {
        render(
            <ChainNotice
                kind='warning'
                titleKey='transactions.notice.pending'
            />,
        )

        expect(screen.queryByText('common.retry.label')).toBeNull()
    })

    it('calls the action when its label is pressed', () => {
        const onPress = vi.fn()
        render(
            <ChainNotice
                kind='error'
                titleKey='transactions.notice.failed'
                action={{ labelKey: 'common.retry.label', onPress }}
            />,
        )

        fireEvent.click(screen.getByText('common.retry.label'))

        expect(onPress).toHaveBeenCalledOnce()
    })
})
