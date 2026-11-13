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

import type { ChainAssetBalance } from '@perawallet/wallet-core-accounts'
import { nativeAssetFor } from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

/**
 * What a cross-chain "Swap for {native}" may pay with, the most valuable first:
 * the native coin of another chain the account can swap from. Only a native
 * coin: the source leg's fee is paid in it, so a token on a chain with none is
 * a dead end, and an airdropped token is the unvetted lure Swap avoids.
 */
export const rankSwapPayAssets = (
    balances: readonly ChainAssetBalance[],
    targetScope: ChainScope,
    canPayOn: (chainId: ChainId) => boolean,
): ChainAssetBalance[] => {
    const targetKey = toScopeKey(targetScope)
    const candidates = balances.filter(
        balance =>
            balance.assetId === nativeAssetFor(balance.scope.chainId).assetId &&
            toScopeKey(balance.scope) !== targetKey &&
            balance.amount.gt(0) &&
            balance.restriction === null &&
            canPayOn(balance.scope.chainId),
    )
    return [...candidates].sort((a, b) => {
        if (a.fiatValue === null) return b.fiatValue === null ? 0 : 1
        if (b.fiatValue === null) return -1
        return b.fiatValue.comparedTo(a.fiatValue)
    })
}
