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

import React from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountMenuBottomSheet } from '../AccountMenuBottomSheet'

vi.mock('@components/core', async () => {
    return {
        PWBottomSheet: ({
            children,
            isVisible,
        }: {
            children: React.ReactNode
            isVisible: boolean
        }) =>
            isVisible ? (
                <div data-testid='PWBottomSheet'>{children}</div>
            ) : null,
        PWToolbar: () => <div data-testid='PWToolbar' />,
        PWIcon: () => <div data-testid='PWIcon' />,
    }
})

vi.mock('@modules/accounts/components/AccountMenu', () => ({
    AccountMenu: () => <div data-testid='AccountMenu' />,
}))

describe('AccountMenuBottomSheet', () => {
    it('renders correctly when isVisible is true', () => {
        const props = {
            isVisible: true,
            onClose: vi.fn(),
            onSelected: vi.fn(),
        }

        render(<AccountMenuBottomSheet {...props} />)
        expect(screen.getByTestId('PWBottomSheet')).toBeTruthy()
        expect(screen.getByTestId('AccountMenu')).toBeTruthy()
        expect(screen.getByTestId('PWToolbar')).toBeTruthy()
    })

    it('does not render when isVisible is false', () => {
        const props = {
            isVisible: false,
            onClose: vi.fn(),
            onSelected: vi.fn(),
        }

        render(<AccountMenuBottomSheet {...props} />)
        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })
})
