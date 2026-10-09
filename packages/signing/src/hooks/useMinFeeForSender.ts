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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    type MinFeeForSenderResult,
} from '../chain-adapter'

/**
 * PQ-aware minimum fee for display and fee inputs: resolves the effective
 * signer of `senderAddress` and applies the remote-config PQ multiplier.
 * Keeps UI fee displays in agreement with fees applied when building
 * transactions.
 */
export const useMinFeeForSender = (
    senderAddress: string | undefined,
    chainId: ChainId,
): MinFeeForSenderResult => {
    const useChainMinFeeForSender =
        plannerChainAdapters.get(chainId).useMinFeeForSender
    return useChainMinFeeForSender(senderAddress)
}
