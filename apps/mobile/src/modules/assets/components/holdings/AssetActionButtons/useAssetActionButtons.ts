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
    chainAccountOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useOnrampScope } from '@perawallet/wallet-core-onramp'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useSwapScope } from '@perawallet/wallet-core-swaps'

export type UseAssetActionButtonsResult = {
    canSwap: boolean
    canBuy: boolean
    canSend: boolean
    canReceive: boolean
}

export const useAssetActionButtons = (
    account: Optional<Nullable<WalletAccount>>,
    chainId: ChainId,
): UseAssetActionButtonsResult => {
    // The account's scope can resolve to another of its chains; the action
    // only belongs on this screen when it runs on the asset's own chain.
    const swapChainId = useSwapScope(account ?? null)?.chainId
    const onrampChainId = useOnrampScope(account?.chains ?? null)?.chainId
    // A send runs on the asset's chain, whichever of the account's chains that is.
    const canSendOnChain = useChainCapability(chainId, 'send')
    const canReceiveOnChain = useChainCapability(chainId, 'receive')
    const isOnChain = !account || chainAccountOf(account, chainId) !== undefined
    return {
        canSwap: swapChainId === chainId,
        canBuy: onrampChainId === chainId,
        canSend: canSendOnChain && isOnChain,
        canReceive: canReceiveOnChain && isOnChain,
    }
}
