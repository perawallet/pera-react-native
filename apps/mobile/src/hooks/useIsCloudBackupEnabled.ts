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
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

/** Defaults off in every environment: the flow is only half-wired until the
 *  settings entry point lands, so it stays hidden unless Remote Config says otherwise. */
export const useIsCloudBackupEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()

    return remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_cloud_backup,
        false,
    )
}
