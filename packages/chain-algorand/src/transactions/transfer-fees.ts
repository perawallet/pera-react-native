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

import { Decimal } from 'decimal.js'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import type {
    BuildContext,
    ChainScope,
    FeeEstimate,
    TransactionIntent,
} from '@perawallet/wallet-core-chain-contract'
import { createWalletAlgorandClient, getMinimumFeeConfig } from '../blockchain'
import { algorandDescriptor } from '../descriptor'
import { algorandNetworkOf } from '../legacy-network'
import { resolveMinFeeForSender } from '../signing/minFeeResolver'
import { assertBuildableIntent } from './transfer-validation'

const signerOf = (intent: TransactionIntent): string =>
    intent.kind === 'transfer' ? intent.from : intent.account

/** The node's suggested minimum fee, in µAlgo. */
export const fetchSuggestedMinFee = async (
    scope: ChainScope,
): Promise<bigint> =>
    BigInt(
        (
            await createWalletAlgorandClient(
                algorandNetworkOf(scope),
            ).getSuggestedParams()
        ).minFee,
    )

/** The minimum fee in µAlgo a transaction sent by `sender` must carry, PQ surcharge included. */
export const resolveAlgorandSenderFee = (
    sender: string,
    suggestedMinFee: bigint,
): bigint => {
    const { minTxnFee, pqMultiplier } = getMinimumFeeConfig()
    return resolveMinFeeForSender({
        senderAddress: sender,
        accounts: useAccountsStore.getState().accounts,
        suggestedMinFee,
        configMinTxnFee: minTxnFee,
        pqMultiplier,
    })
}

export const estimateAlgorandTransferFee = async (
    intent: TransactionIntent,
    context: BuildContext,
): Promise<FeeEstimate> => {
    assertBuildableIntent(intent, context)
    const fee = resolveAlgorandSenderFee(
        signerOf(intent),
        await fetchSuggestedMinFee(context.scope),
    )
    return {
        assetRef: algorandDescriptor.nativeAsset.ref,
        amount: new Decimal(fee.toString()),
    }
}
