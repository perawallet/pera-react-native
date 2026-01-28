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

import { render, fireEvent, screen } from '@test-utils/render'
import { vi } from 'vitest'
import { ImportRekeyedAddressesFooter } from '../ImportRekeyedAddressesFooter'

describe('ImportRekeyedAddressesFooter', () => {
    it('renders correctly', () => {
        render(
            <ImportRekeyedAddressesFooter
                onContinue={vi.fn()}
                onSkip={vi.fn()}
                canContinue={false}
            />,
        )

        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.continue'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.skip'),
        ).toBeTruthy()
    })

    it('disables continue button when canContinue is false', () => {
        const onContinue = vi.fn()
        render(
            <ImportRekeyedAddressesFooter
                onContinue={onContinue}
                onSkip={vi.fn()}
                canContinue={false}
            />,
        )

        fireEvent.click(
            screen.getByText('onboarding.import_rekeyed_addresses.continue'),
        )
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('calls onContinue when continue button is pressed and enabled', () => {
        const onContinue = vi.fn()
        // Note: PWButton might behave differently regarding touch events depending on mock, 
        // but typically fireEvent.press on the text or button works if not disabled.
        // If disabled prop is handled by native Button or opacity, fireEvent might still simulate it if only prop is checked,
        // but typically we check logic.
        render(
            <ImportRekeyedAddressesFooter
                onContinue={onContinue}
                onSkip={vi.fn()}
                canContinue={true}
            />,
        )

        fireEvent.click(
            screen.getByText('onboarding.import_rekeyed_addresses.continue'),
        )
        expect(onContinue).toHaveBeenCalled()
    })

    it('calls onSkip when skip button is pressed', () => {
        const onSkip = vi.fn()
        render(
            <ImportRekeyedAddressesFooter
                onContinue={vi.fn()}
                onSkip={onSkip}
                canContinue={false}
            />,
        )

        fireEvent.click(
            screen.getByText('onboarding.import_rekeyed_addresses.skip'),
        )
        expect(onSkip).toHaveBeenCalled()
    })
})
