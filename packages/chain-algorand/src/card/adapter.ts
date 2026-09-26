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

import { waitForTransactionConfirmation } from '@perawallet/wallet-core-blockchain'
import type { CardChainAdapter } from '@perawallet/wallet-core-card'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { cardAlgorandClient } from './client'
import { algorandDelegationRequests } from './delegation'
import { algorandAutoDraw } from './escrow/killswitch'
import { compileAutoDrawProgram, resolveEscrowChainConfig } from './escrow/lsig'
import { algorandEscrowWithdrawals } from './escrow/withdrawal'

export const algorandCardAdapter: CardChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    resolveEscrowChainConfig,
    compileAutoDrawProgram: network => compileAutoDrawProgram({ network }),
    ...algorandDelegationRequests,
    getAssetBalance: async (network, address, assetId) => {
        const info = await cardAlgorandClient(network)
            .client.algod.accountInformation(address)
            .do()
        const holding = info.assets?.find(
            asset => String(asset.assetId) === assetId,
        )
        return holding?.amount ?? 0n
    },
    awaitConfirmation: (network, txId) =>
        waitForTransactionConfirmation(
            cardAlgorandClient(network).client.algod,
            txId,
        ),
    withdrawal: algorandEscrowWithdrawals,
    autoDraw: algorandAutoDraw,
}
