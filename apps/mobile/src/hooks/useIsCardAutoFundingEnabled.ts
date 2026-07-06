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

import { config } from '@perawallet/wallet-core-config'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

/**
 * Kill-switch for card auto-funding (Baanx delegation). Off in production until
 * the real Algorand contract ships; on in dev & staging for testing. This flag
 * only gates the UI — the hard guarantee that prod never signs an unpinned
 * program is `verifyDelegationProgram` (packages/card), not this flag.
 */
export const useIsCardAutoFundingEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    const fallback = __DEV__ || config.appEnvironment === 'staging'
    return remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_card_auto_funding,
        fallback,
    )
}
