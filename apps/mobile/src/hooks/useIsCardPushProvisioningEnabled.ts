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

import { config } from '@perawallet/wallet-core-config'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

/**
 * Kill switch for native Add to Apple/Google Wallet push provisioning. On in
 * dev & staging so the flow can be exercised the moment the OS-level gates
 * (Apple entitlement, Google TapAndPay allowlisting) are granted; off in
 * production until certification. The device-level availability check in
 * useAddCardToWallet is the real gate — this flag only lets us pull the
 * feature remotely without a release.
 */
export const useIsCardPushProvisioningEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    const fallback = __DEV__ || config.appEnvironment === 'staging'
    return remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_card_push_provisioning,
        fallback,
    )
}
