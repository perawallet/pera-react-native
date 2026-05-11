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

import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'

// Verifies the test platform driver + test keystore unblock the onboarding
// hook chain. The screen mounts under the real `useOnboardingScreen` →
// `useCreateAccount` → `useKMS` → `getKeystoreStore()` chain; if the harness
// is wired correctly, the buttons render without the previous "keystore not
// initialized" cascade.
describe('Flow: Onboarding entry', () => {
    it('Given the onboarding screen mounts, then both create and import buttons are present', async () => {
        renderWithNavigation(OnboardingScreen, 'Onboarding')

        await waitFor(() => {
            expect(
                screen.getByTestId('onboarding_create_wallet_button'),
            ).toBeTruthy()
        })
        expect(
            screen.getByTestId('onboarding_import_account_button'),
        ).toBeTruthy()
    })

    it('Given the onboarding screen, when the user taps "Import account" and then "Recover Wallet", then the import options sheet opens', async () => {
        renderWithNavigation(OnboardingScreen, 'Onboarding', {
            additionalScreens: [
                {
                    name: 'ImportAccountOptions',
                    component: ImportAccountOptionsScreen,
                },
            ],
        })

        await waitFor(() =>
            screen.getByTestId('onboarding_import_account_button'),
        )

        fireEvent.click(screen.getByTestId('onboarding_import_account_button'))

        // Tapping "Import account" pushes the ImportAccountOptions screen,
        // where the user picks "Recover Wallet" to open the HD/Algo25 sheet.
        await waitFor(() =>
            screen.getByTestId('import_account_options_recover_wallet_button'),
        )

        fireEvent.click(
            screen.getByTestId('import_account_options_recover_wallet_button'),
        )

        // The bottom sheet renders its content when isVisible flips true.
        await waitFor(() => {
            expect(
                screen.getByTestId('import_options_hd_wallet_button'),
            ).toBeTruthy()
        })
    })
})
