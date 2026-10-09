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

import type { CardManualDepositBuildParams } from '@perawallet/wallet-core-card'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import { cardAlgorandClient } from './client'

/**
 * Manual funding on the escrow design is a plain transfer to the card's own
 * account: it is already opted in and rekeyed to the card app, so the
 * contract spends from it without any further authorization.
 */
export const buildAlgorandManualDeposit = async (
    {
        sender,
        cardAddress,
        assetId,
        amount,
    }: CardManualDepositBuildParams & { assetId: string },
    network: Network,
): Promise<PeraTransaction[]> => {
    const composer = cardAlgorandClient(network).newGroup()
    composer.addAssetTransfer({
        sender,
        receiver: cardAddress,
        assetId: BigInt(assetId),
        amount,
    })
    const { transactions } = await composer.build()
    return transactions.map(built => built.txn)
}
