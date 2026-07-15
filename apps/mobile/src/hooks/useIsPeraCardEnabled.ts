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

import { isDebug, isStaging } from '@perawallet/wallet-core-config'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

/**
 * Pera Card is in progress and hidden from store users. Defaults visible in
 * debug and staging builds so the team can keep testing; Firebase Remote
 * Config can override.
 */
export const useIsPeraCardEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    return remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_pera_card,
        isDebug || isStaging,
    )
}
