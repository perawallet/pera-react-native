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
import { useIsQuantumAccountsEnabled } from './useIsQuantumAccountsEnabled'

/**
 * Gates the one-time "this dApp may not support Quantum accounts" warning.
 * Defaults ON: the flag exists so the warning can be switched *off* once dApps
 * have implemented PQ support. Composing `useIsQuantumAccountsEnabled` rather
 * than re-reading its flag inherits the web capability gate and the
 * dev/staging dark-launch fallback for free.
 */
export const useIsQuantumDappWarningEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    const isQuantumEnabled = useIsQuantumAccountsEnabled()
    return (
        isQuantumEnabled &&
        remoteConfig.getBooleanValue(
            RemoteConfigKeys.enable_quantum_dapp_warning,
            true,
        )
    )
}
