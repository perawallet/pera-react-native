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
import { TransactionIcon } from '../TransactionIcon'

vi.mock('@components/core', () => ({
    PWRoundIcon: vi.fn(({ icon, size }) => (
        <div data-testid="pw-round-icon" data-icon={icon} data-size={size}>
            PWRoundIcon
        </div>
    )),
}))

describe('TransactionIcon', () => {
    it('renders payment icon for payment type', () => {
        const { getByTestId } = render(<TransactionIcon type="payment" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/payment')
    })

    it('renders swap icon for asset-transfer type', () => {
        const { getByTestId } = render(<TransactionIcon type="asset-transfer" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/swap')
    })

    it('renders asset-config icon for asset-config type', () => {
        const { getByTestId } = render(<TransactionIcon type="asset-config" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/asset-config')
    })

    it('renders asset-freeze icon for asset-freeze type', () => {
        const { getByTestId } = render(<TransactionIcon type="asset-freeze" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/asset-freeze')
    })

    it('renders key-registration icon for key-registration type', () => {
        const { getByTestId } = render(
            <TransactionIcon type="key-registration" />,
        )

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe(
            'transactions/key-registration',
        )
    })

    it('renders application-call icon for app-call type', () => {
        const { getByTestId } = render(<TransactionIcon type="app-call" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe(
            'transactions/application-call',
        )
    })

    it('renders opt-in icon for asset-opt-in type', () => {
        const { getByTestId } = render(<TransactionIcon type="asset-opt-in" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/opt-in')
    })

    it('renders opt-out icon for asset-opt-out type', () => {
        const { getByTestId } = render(<TransactionIcon type="asset-opt-out" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/opt-out')
    })

    it('renders group icon for group type', () => {
        const { getByTestId } = render(<TransactionIcon type="group" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/group')
    })

    it('renders generic icon for unknown types', () => {
        const { getByTestId } = render(
            <TransactionIcon type={'unknown' as any} />,
        )

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-icon')).toBe('transactions/generic')
    })

    it('uses md size by default (maps to lg)', () => {
        const { getByTestId } = render(<TransactionIcon type="payment" />)

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-size')).toBe('md')
    })

    it('maps sm size prop to md icon size', () => {
        const { getByTestId } = render(
            <TransactionIcon type="payment" size="sm" />,
        )

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-size')).toBe('md')
    })

    it('maps md size prop to lg icon size', () => {
        const { getByTestId } = render(
            <TransactionIcon type="payment" size="md" />,
        )

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-size')).toBe('lg')
    })

    it('maps lg size prop to xl icon size', () => {
        const { getByTestId } = render(
            <TransactionIcon type="payment" size="lg" />,
        )

        const icon = getByTestId('pw-round-icon')
        expect(icon.getAttribute('data-size')).toBe('xl')
    })
})
