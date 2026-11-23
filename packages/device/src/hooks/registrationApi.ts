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

import {
    readBooleanFlagBuildDefault,
    readRemoteConfigWithOverrides,
    RemoteConfigKeys,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Read per request, not per session, so flipping the flag takes effect on the
// next registration without a relaunch.
export const isDeviceRegistrationV4Enabled = (): boolean =>
    readRemoteConfigWithOverrides(
        getProvider().remoteConfig,
        useRemoteConfigStore.getState().configOverrides,
    ).getBooleanValue(
        RemoteConfigKeys.enable_device_registration_v4,
        readBooleanFlagBuildDefault(
            RemoteConfigKeys.enable_device_registration_v4,
        ),
    )

/**
 * {@link isDeviceRegistrationV4Enabled}, re-rendering when a developer override
 * flips it. The store holds only overrides, so a Remote Config value activated
 * mid-session is read on the next render, not pushed.
 */
export const useIsDeviceRegistrationV4Enabled = (): boolean =>
    useRemoteConfigStore(() => isDeviceRegistrationV4Enabled())
