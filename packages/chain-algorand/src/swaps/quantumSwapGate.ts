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
    readRemoteConfigWithOverrides,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { AlgorandRemoteConfigKeys } from '../blockchain'
import { ALGORAND_CHAIN_ID } from '../chain-id'

/**
 * Gates swapping FROM a quantum (or rekeyed-to-quantum) account. The backend
 * must price the pqsig fee surcharge into prepared swap groups, so the remote
 * flag is the kill switch if that pricing regresses. It defaults on in debug
 * and staging builds for testing, and off in production until enabled.
 */
export const isAlgorandQuantumSwapEnabled = (): boolean => {
    const { chains, remoteConfig } = getProvider()
    const capabilities = chains.capabilities(ALGORAND_CHAIN_ID)
    return (
        capabilities.quantumAccounts &&
        capabilities.swap &&
        readRemoteConfigWithOverrides(
            remoteConfig,
            useRemoteConfigStore.getState().configOverrides,
        ).getBooleanValue(
            AlgorandRemoteConfigKeys.enable_quantum_swap,
            isDebug || isStaging,
        )
    )
}
