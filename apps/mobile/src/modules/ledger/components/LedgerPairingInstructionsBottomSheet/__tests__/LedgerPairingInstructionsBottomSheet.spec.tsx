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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { LedgerPairingInstructionsBottomSheet } from '../LedgerPairingInstructionsBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('LedgerPairingInstructionsBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onContinue: vi.fn(),
        onCancel: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the title and subtitle', () => {
        render(<LedgerPairingInstructionsBottomSheet {...defaultProps} />)

        expect(
            screen.getByText('ledger.pairing_instructions.title'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.pairing_instructions.subtitle'),
        ).toBeTruthy()
    })

    it('renders all four numbered pairing steps', () => {
        render(<LedgerPairingInstructionsBottomSheet {...defaultProps} />)

        expect(
            screen.getByText('ledger.pairing_instructions.step_1'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.pairing_instructions.step_2'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.pairing_instructions.step_3'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.pairing_instructions.step_4'),
        ).toBeTruthy()
    })

    it('calls onContinue when the continue button is pressed', () => {
        const onContinue = vi.fn()
        render(
            <LedgerPairingInstructionsBottomSheet
                {...defaultProps}
                onContinue={onContinue}
            />,
        )

        fireEvent.click(
            screen.getByText('ledger.pairing_instructions.continue'),
        )

        expect(onContinue).toHaveBeenCalledTimes(1)
    })
})
