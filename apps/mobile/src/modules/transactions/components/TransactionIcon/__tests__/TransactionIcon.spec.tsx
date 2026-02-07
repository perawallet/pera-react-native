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
import { TransactionIcon, TransactionIconType } from '../TransactionIcon'
import { PWIcon } from '@components/core'

vi.mock('@components/core', async importOriginal => {
    const actual = await importOriginal<typeof import('@components/core')>()
    return {
        ...actual,
        PWIcon: vi.fn(() => null),
    }
})

describe('TransactionIcon', () => {
    it('renders correct icon for payment type', () => {
        render(<TransactionIcon type='payment' />)
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'transactions/payment',
                size: 'sm', // sm maps to 24px in our current setup for sm transactions
            }),
            undefined,
        )
    })

    it('renders correct icon for asset-transfer type', () => {
        render(<TransactionIcon type='asset-transfer' />)
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'transactions/swap',
            }),
            undefined,
        )
    })

    it('uses correct size mapping for md requested size', () => {
        vi.clearAllMocks()
        render(
            <TransactionIcon
                type='payment'
                size='md'
            />,
        )
        // For size='md', we currently use size='md' (which is probably 32px or similar in system)
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                size: 'md',
            }),
            undefined,
        )
    })

    it('renders generic icon for unknown type', () => {
        vi.clearAllMocks()
        render(
            <TransactionIcon
                type={'unknown' as unknown as TransactionIconType}
            />,
        )
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'transactions/generic',
            }),
            undefined,
        )
    })
})
