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

import { describe, expect, it } from 'vitest'
import { render, screen } from '@test-utils/render'
import { TransactionStatusBadge } from '../TransactionStatusBadge'

describe('TransactionStatusBadge', () => {
    it('spins while pending', () => {
        render(<TransactionStatusBadge status='pending' />)

        expect(screen.getByText('transactions.common.pending')).toBeTruthy()
        expect(
            screen.getByTestId('transaction_detail_status_spinner'),
        ).toBeTruthy()
    })

    it.each(['completed', 'failed'] as const)('is still once %s', status => {
        render(<TransactionStatusBadge status={status} />)

        expect(screen.getByText(`transactions.common.${status}`)).toBeTruthy()
        expect(
            screen.queryByTestId('transaction_detail_status_spinner'),
        ).toBeNull()
    })
})
