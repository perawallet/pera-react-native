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
import { routeCapabilities } from '@routes/capabilities'

/**
 * Quantum Accounts ships dark: fully built but hidden in production until the
 * Algorand node release lands. Defaults visible in dev & staging so the team
 * can keep testing; Firebase Remote Config can override. Additionally gated
 * by routeCapabilities.quantum — off on web, where there is no working
 * signer path yet (see capabilities.web.ts).
 */
export const useIsQuantumAccountsEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    const fallback = __DEV__ || config.appEnvironment === 'staging'
    return (
        routeCapabilities.quantum &&
        remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_quantum_accounts,
            fallback,
        )
    )
}
