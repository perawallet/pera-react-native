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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PasskeyUnlockSetupFailure } from './usePasskeyUnlockSetup.web'

// Literal keys, so the unused-translation-key lint can see every one.
export const PASSKEY_SETUP_FAILURE_COPY: Record<
    PasskeyUnlockSetupFailure,
    { error: string; hint: Nullable<{ title: string; body: string }> }
> = {
    'not-saved': {
        error: 'vault.passkey_setup.error_not_saved',
        hint: {
            title: 'vault.passkey_setup.hint_not_saved_title',
            body: 'vault.passkey_setup.hint_not_saved_body',
        },
    },
    'prf-unsupported': {
        error: 'vault.passkey_setup.error_prf_unsupported',
        hint: {
            title: 'vault.passkey_setup.hint_prf_title',
            body: 'vault.passkey_setup.hint_prf_body',
        },
    },
    unexpected: {
        error: 'vault.passkey_setup.error_unexpected',
        hint: null,
    },
}
