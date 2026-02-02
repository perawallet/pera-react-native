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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { TransactionStatusBadge } from '../TransactionStatusBadge'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'transactions.common.pending': 'Pending',
                'transactions.common.completed': 'Completed',
                'transactions.common.failed': 'Failed',
            }
            return translations[key] ?? key
        },
    }),
}))

describe('TransactionStatusBadge', () => {
    it('renders pending status', () => {
        const { getByText } = render(
            <TransactionStatusBadge status='pending' />,
        )

        expect(getByText('Pending')).toBeTruthy()
    })

    it('renders completed status', () => {
        const { getByText } = render(
            <TransactionStatusBadge status='completed' />,
        )

        expect(getByText('Completed')).toBeTruthy()
    })

    it('renders failed status', () => {
        const { getByText } = render(<TransactionStatusBadge status='failed' />)

        expect(getByText('Failed')).toBeTruthy()
    })
})
