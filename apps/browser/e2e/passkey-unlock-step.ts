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

import type { Page } from '@playwright/test'

// Create Password routes to the passkey unlock step only when the browser
// reports PRF support and its probe settled before submit, so wait for
// whichever screen lands. Declining also spends the one-time offer prompt,
// which would otherwise queue behind the PIN nudge and hold later sheets.
export const skipPasskeyUnlockStep = async (
    targetPage: Page,
): Promise<void> => {
    const skip = targetPage.getByTestId('passkey-unlock-setup-skip')
    const welcome = targetPage.getByTestId('onboarding_create_wallet_button')
    await skip
        .or(welcome)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
    if (!(await skip.isVisible())) return
    await skip.click({ timeout: 5000 })
    await skip.waitFor({ state: 'hidden', timeout: 20_000 })
}
