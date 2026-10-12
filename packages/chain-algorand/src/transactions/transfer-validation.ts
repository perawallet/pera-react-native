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

import type {
    BuildContext,
    TransactionIntent,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { isAlgorandNativeAssetId } from '../descriptor'
import { algorandNetworkOf } from '../legacy-network'

// `BigInt('')` and `BigInt('0x0')` are both 0n, so anything but a canonical
// decimal id could quietly become ALGO at the builder.
const CANONICAL_ASSET_ID = /^(0|[1-9]\d*)$/

/** Throws unless the intent can be built on the context's Algorand network. */
export const assertBuildableIntent = (
    intent: TransactionIntent,
    context: BuildContext,
): void => {
    algorandNetworkOf(context.scope)
    if (
        intent.assetRef.chainId !== ALGORAND_CHAIN_ID ||
        !CANONICAL_ASSET_ID.test(intent.assetRef.assetId)
    ) {
        throw new InvalidSendParamsError()
    }
    if (
        intent.kind === 'transfer' &&
        (!intent.amount.isInteger() || intent.amount.isNegative())
    ) {
        throw new InvalidSendParamsError()
    }
    if (
        intent.kind === 'asset-opt-in' &&
        isAlgorandNativeAssetId(intent.assetRef.assetId)
    ) {
        throw new InvalidSendParamsError()
    }
}
