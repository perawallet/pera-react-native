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

import { isProd } from '@perawallet/wallet-core-config'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { routeCapabilities } from '@routes/capabilities'

/**
 * The password manager ships dark: logins are keystore-only and unrecoverable
 * if the device is lost, so nothing shows until Remote Config (or the
 * developer Feature Flags override) explicitly turns it on. Never in
 * production, whatever the flag says: that variant compiles the native
 * credential provider out (`providesPasswords` in app.config.builder.js), and
 * Developer Settings ships there, so without this a user could fill a vault
 * nothing can autofill. Also folds in the static
 * routeCapabilities.passwordManager platform gate — off on web, which has no
 * OS credential provider at all — so callers have a single check.
 */
export const useIsPasswordManagerEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    return (
        !isProd &&
        routeCapabilities.passwordManager &&
        remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_password_manager,
            false,
        )
    )
}
