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
import { describe, expect, it, vi } from 'vitest'
import { MultisigIntroductionDialog } from '../MultisigIntroductionDialog'

const translations: Record<string, string> = {
    'multisig.introduction.title': 'Shared Account',
    'multisig.introduction.bullet_1':
        'Enhanced security by requiring multiple approvals. Great for shared or high-value accounts.',
    'multisig.introduction.bullet_2':
        'Assign signers and required approvals per transaction.',
    'multisig.introduction.bullet_3':
        'Monitor activity and signer actions securely.',
    'multisig.introduction.continue': 'Continue',
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => translations[key] ?? key,
    }),
}))

describe('MultisigIntroductionDialog', () => {
    it('renders the artwork, title, bullets, and continue action', () => {
        render(
            <MultisigIntroductionDialog
                isVisible
                onContinue={vi.fn()}
                onDismiss={vi.fn()}
            />,
        )

        expect(screen.getByTestId('PWImage')).toBeTruthy()
        expect(screen.getByText('Shared Account')).toBeTruthy()
        expect(
            screen.getByText(
                'Enhanced security by requiring multiple approvals. Great for shared or high-value accounts.',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'Assign signers and required approvals per transaction.',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText('Monitor activity and signer actions securely.'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('multisig_introduction_continue_button'),
        ).toBeTruthy()
    })

    it('calls onContinue when continue is pressed', () => {
        const onContinue = vi.fn()

        render(
            <MultisigIntroductionDialog
                isVisible
                onContinue={onContinue}
                onDismiss={vi.fn()}
            />,
        )

        fireEvent.click(
            screen.getByTestId('multisig_introduction_continue_button'),
        )

        expect(onContinue).toHaveBeenCalledTimes(1)
    })

    it('does not render when hidden', () => {
        render(
            <MultisigIntroductionDialog
                isVisible={false}
                onContinue={vi.fn()}
                onDismiss={vi.fn()}
            />,
        )

        expect(screen.queryByTestId('multisig_introduction_dialog')).toBeNull()
    })
})
