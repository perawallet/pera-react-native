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
import React from 'react'
import { render, screen } from '@test-utils/render'
import { AssetTierChip } from '../AssetTierChip'

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

describe('AssetTierChip', () => {
    it('renders the unit name', () => {
        render(
            <AssetTierChip
                unitName='ALGO'
                verificationTier='trusted'
            />,
        )

        expect(screen.getByText('ALGO')).toBeTruthy()
    })

    it('renders the verification icon for a verified tier', () => {
        render(
            <AssetTierChip
                unitName='USDC'
                verificationTier='verified'
            />,
        )

        expect(screen.getByTestId('icon-assets/verified')).toBeTruthy()
    })

    it('renders the suspicious icon for a suspicious tier', () => {
        render(
            <AssetTierChip
                unitName='BAD'
                verificationTier='suspicious'
            />,
        )

        expect(screen.getByTestId('icon-assets/suspicious')).toBeTruthy()
    })

    it('does not render an icon for an unverified tier', () => {
        render(
            <AssetTierChip
                unitName='UNV'
                verificationTier='unverified'
            />,
        )

        expect(screen.queryByTestId('icon-assets/verified')).toBeNull()
        expect(screen.queryByTestId('icon-assets/trusted')).toBeNull()
        expect(screen.queryByTestId('icon-assets/suspicious')).toBeNull()
    })

    it('renders an empty label when unit name is missing', () => {
        render(<AssetTierChip verificationTier='verified' />)

        expect(screen.getByTestId('icon-assets/verified')).toBeTruthy()
    })
})
