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
    useAccountAssetBalanceQuery,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'

export type UseEthereumApprovalDetailsResult = {
    /** The signer's holding of the token a spend approval covers; null when it holds none Pera has found. */
    tokenBalance: Nullable<AssetWithAccountBalance>
}

export const useEthereumApprovalDetails = ({
    standardCall,
    signingAccount,
    scope,
}: EthereumTransactionPresentation): UseEthereumApprovalDetailsResult => {
    const isSpend =
        standardCall?.kind === 'token-approval' && !!standardCall.spendApproval
    // Holdings are keyed by checksummed address; the calldata's may be any case.
    const assetId = isSpend
        ? addressCodecs.get(scope.chainId).normalize(standardCall.contract)
        : undefined
    const { data } = useAccountAssetBalanceQuery(
        signingAccount ?? undefined,
        assetId,
        scope,
    )
    return { tokenBalance: data }
}
