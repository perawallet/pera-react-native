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
import { AlgorandRemoteConfigKeys } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useCapability } from '@hooks/useCapability'

/**
 * Gates swapping FROM a quantum (or rekeyed-to-quantum) account. It depends on
 * the backend pricing the pqsig fee surcharge into prepared swap groups — the
 * flag is the kill switch if that pricing regresses. Defaults on in dev &
 * staging for testing, off in production until Firebase enables it, and gated
 * by the `quantumAccounts` and `swap` chain capabilities.
 */
export const useIsQuantumSwapEnabled = (): boolean => {
    const remoteConfig = useRemoteConfig()
    const isQuantumAvailable = useCapability({
        platform: 'quantum',
        anyChain: 'quantumAccounts',
    })
    const isSwapAvailable = useCapability({ anyChain: 'swap' })
    const fallback = __DEV__ || config.appEnvironment === 'staging'
    return (
        isQuantumAvailable &&
        isSwapAvailable &&
        remoteConfig.getBooleanValue(
            AlgorandRemoteConfigKeys.enable_quantum_swap,
            fallback,
        )
    )
}
