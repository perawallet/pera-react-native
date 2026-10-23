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
    readRemoteConfigWithOverrides,
    RemoteConfigKeys,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Read per request, not per session, so flipping the flag takes effect on the
// next registration without a relaunch. Keyed on the backend variant, not on
// debug: a local debug bundle of the production variant talks to the
// production backend. Every non-production variant talks to staging, which
// serves v4, so it defaults on; production waits for Remote Config.
export const isDeviceRegistrationV4Enabled = (): boolean =>
    readRemoteConfigWithOverrides(
        getProvider().remoteConfig,
        useRemoteConfigStore.getState().configOverrides,
    ).getBooleanValue(RemoteConfigKeys.enable_device_registration_v4, !isProd)
