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
import { render, screen } from '@test-utils/render'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { LedgerVerificationCard } from '../LedgerVerificationCard'

const ADDRESS = '4WU2BYFAVWV33766FLYBEBVMDSCBYB2I5U257SGGHJ6FHFB3ZVDIVSHXLI'

describe('LedgerVerificationCard', () => {
    it('renders the awaiting label and spinner when status is awaiting', () => {
        render(
            <LedgerVerificationCard
                address={ADDRESS}
                status='awaiting'
                testID='card'
            />,
        )

        expect(screen.getByText('ledger.verify.awaiting')).toBeTruthy()
        expect(screen.getByTestId('card-spinner')).toBeTruthy()
        expect(screen.getByText(ADDRESS)).toBeTruthy()
    })

    it('renders the verified label and check icon when status is verified', () => {
        render(
            <LedgerVerificationCard
                address={ADDRESS}
                status='verified'
                testID='card'
            />,
        )

        expect(screen.getByText('ledger.verify.verified')).toBeTruthy()
        expect(screen.getByTestId('card-check')).toBeTruthy()
        expect(screen.getByText(ADDRESS)).toBeTruthy()
    })
})
