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

import { Platform } from 'react-native'
import * as Application from 'expo-application'
import * as IntentLauncher from 'expo-intent-launcher'
import { logger } from '@perawallet/wallet-core-shared'

// Android 14+ Credential Manager settings. Passing a `package:<id>` data URI
// deep-links straight to this app's credential-provider entry. The native
// module's `openProviderSettings` fires this action WITHOUT the data URI, so
// it falls through to the generic App Info screen on most devices — hence we
// fire the targeted intent ourselves first.
const ACTION_CREDENTIAL_PROVIDER = 'android.settings.CREDENTIAL_PROVIDER'

/**
 * Opens the OS credential-provider settings for this app.
 *
 * Android: tries the targeted `CREDENTIAL_PROVIDER` intent (with the package
 * data URI) and falls back to `nativeFallback` if the OS can't resolve it
 * (e.g. Android < 14). iOS has no public deep-link, so it always defers to
 * `nativeFallback`.
 */
export const openCredentialProviderSettings = async (
    nativeFallback: () => Promise<boolean>,
): Promise<void> => {
    if (Platform.OS === 'android' && Application.applicationId) {
        try {
            await IntentLauncher.startActivityAsync(
                ACTION_CREDENTIAL_PROVIDER,
                { data: `package:${Application.applicationId}` },
            )
            return
        } catch (err) {
            logger.warn(
                'CREDENTIAL_PROVIDER intent unavailable; using native fallback',
                { error: err },
            )
        }
    }

    await nativeFallback()
}
