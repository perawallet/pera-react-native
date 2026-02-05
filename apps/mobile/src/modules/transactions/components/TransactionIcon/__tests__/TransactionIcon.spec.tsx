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
import { PWRoundIcon } from '@components/core'

vi.mock('@components/core', () => ({
    PWRoundIcon: vi.fn(() => null),
}))

describe('TransactionIcon', () => {
    it('renders correct icon for payment type', () => {
        render(<TransactionIcon type='payment' />)
        expect(PWRoundIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                icon: 'transactions/payment',
                size: 'md',
            }),
            undefined,
        )
    })

    it('renders correct icon for asset-transfer type', () => {
        render(<TransactionIcon type='asset-transfer' />)
        expect(PWRoundIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                icon: 'transactions/swap',
            }),
            undefined,
        )
    })

    it('uses correct size mapping', () => {
        vi.clearAllMocks()
        render(
            <TransactionIcon
                type='payment'
                size='md'
            />,
        )
        expect(PWRoundIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                size: 'lg',
            }),
            undefined,
        )

        vi.clearAllMocks()
        render(
            <TransactionIcon
                type='payment'
                size='lg'
            />,
        )
        expect(PWRoundIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                size: 'xl',
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
        expect(PWRoundIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                icon: 'transactions/generic',
            }),
            undefined,
        )
    })
})
