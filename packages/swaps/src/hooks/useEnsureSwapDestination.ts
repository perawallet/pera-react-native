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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { swapChainAdapters, type EnsureSwapReceivable } from '../chain-adapter'

export type UseEnsureSwapDestinationResult = {
    ensureReceivable: EnsureSwapReceivable
}

const canAlwaysReceive: EnsureSwapReceivable = async () => true
const useNoReceivePreparation = (): EnsureSwapReceivable => canAlwaysReceive

export const useEnsureSwapDestination = (
    scope: ChainScope,
): UseEnsureSwapDestinationResult => {
    // The adapter's hook runs as part of this one, so a chain that resolves to
    // a different adapter changes the hook order: remount the caller on it.
    const useEnsureReceivable =
        (swapChainAdapters.has(scope.chainId)
            ? swapChainAdapters.get(scope.chainId).useEnsureReceivable
            : undefined) ?? useNoReceivePreparation
    return { ensureReceivable: useEnsureReceivable() }
}
