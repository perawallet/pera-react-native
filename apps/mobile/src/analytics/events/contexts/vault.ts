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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Vault passkey unlock: the onboarding step, the one-time offer and Settings. */
export enum VaultEvent {
    PasskeyOfferView = 'vault_passkey_offer_view', // The onboarding step or the one-time prompt was shown
    PasskeyEnableSuccess = 'vault_passkey_enable_success', // The PRF-wrapped master key was written
    PasskeyEnableFail = 'vault_passkey_enable_fail', // A failure state was reached
    PasskeyOfferSkip = 'vault_passkey_offer_skip', // Not now on the step or the prompt
}

export type PasskeySetupScreen = 'onboarding' | 'prompt' | 'settings'

export interface VaultRequiredPayloads {
    [VaultEvent.PasskeyOfferView]: { [Key.ScreenName]: PasskeySetupScreen }
    [VaultEvent.PasskeyEnableSuccess]: { [Key.ScreenName]: PasskeySetupScreen }
    [VaultEvent.PasskeyEnableFail]: {
        [Key.ScreenName]: PasskeySetupScreen
        [Key.ErrorCause]: string
    }
    [VaultEvent.PasskeyOfferSkip]: { [Key.ScreenName]: PasskeySetupScreen }
}
