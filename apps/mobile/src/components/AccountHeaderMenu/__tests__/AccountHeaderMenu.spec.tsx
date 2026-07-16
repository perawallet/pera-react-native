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

import React from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountHeaderMenu } from '../AccountHeaderMenu'

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: vi.fn() }),
}))

describe('AccountHeaderMenu', () => {
    it('renders with the default testID', () => {
        render(<AccountHeaderMenu />)
        expect(screen.getByTestId('account_header_menu')).toBeTruthy()
    })

    it('renders with the provided testID', () => {
        render(<AccountHeaderMenu testID='custom_menu' />)
        expect(screen.getByTestId('custom_menu')).toBeTruthy()
    })
})
