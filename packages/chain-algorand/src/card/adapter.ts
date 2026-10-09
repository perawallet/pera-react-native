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

import { toAlgodError, waitForTransactionConfirmation } from '../blockchain'
import {
    canSignProgram,
    isDelegatedAccount,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    CardEscrowNotConfiguredError,
    type CardChainAdapter,
} from '@perawallet/wallet-core-card'
import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import { canSignArc60 } from '../accounts/vocabulary'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../legacy-network'
import { cardAlgorandClient } from './client'
import {
    algorandDelegationRequests,
    BAANX_ALGORAND_NETWORK,
} from './delegation'
import { algorandEscrowWithdrawals } from './escrow/withdrawal'
import { buildAlgorandManualDeposit } from './manualDeposit'
import { useAlgorandCardAutoDraw } from './useAlgorandCardAutoDraw'

// Both mean the same thing to the user: the account can't cover the fee and
// keep its minimum balance.
const INSUFFICIENT_BALANCE_CODES: ReadonlySet<string> = new Set([
    'below_min_balance',
    'overspend',
])

const settlementAsset: CardChainAdapter['settlementAsset'] = scope =>
    getKnownAssetId('USDC', scope)

export const algorandCardAdapter: CardChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    settlementAsset,
    ...algorandDelegationRequests,
    getAssetBalance: async (scope, address, assetId) => {
        const info = await cardAlgorandClient(algorandNetworkOf(scope))
            .client.algod.accountInformation(address)
            .do()
        const holding = info.assets?.find(
            asset => String(asset.assetId) === assetId,
        )
        return holding?.amount ?? 0n
    },
    awaitConfirmation: (scope, txId) =>
        waitForTransactionConfirmation(
            cardAlgorandClient(algorandNetworkOf(scope)).client.algod,
            txId,
        ),
    buildManualDeposit: (params, scope) => {
        const assetId = settlementAsset(scope)
        if (assetId === null) {
            return Promise.reject(new CardEscrowNotConfiguredError())
        }
        return buildAlgorandManualDeposit(
            { ...params, assetId },
            algorandNetworkOf(scope),
        )
    },
    // A rekeyed account's authority sits elsewhere, so the card contract can't
    // draw from it. Ledger signs the sign-in proof on-device but its firmware
    // never signs a program.
    fundingSourceEligibility: account => ({
        canFund: !isDelegatedAccount(account, ALGORAND_CHAIN_ID),
        canProveOwnership: canSignArc60(account),
        canAutoDraw: canSignProgram(account, ALGORAND_CHAIN_ID),
    }),
    describeError: error =>
        INSUFFICIENT_BALANCE_CODES.has(toAlgodError(error).code)
            ? 'insufficient-native-balance'
            : null,
    // Baanx also settles from EVM networks (e.g. "linea" with 0x hashes),
    // which the Algorand explorer can't resolve. `custom` has no explorer, and
    // a bare `/tx/…` path would make Linking.openURL reject.
    transactionUrl: (hash, legNetwork, scope) => {
        if (legNetwork.trim().toLowerCase() !== BAANX_ALGORAND_NETWORK) {
            return null
        }
        const { explorerUrl } = getAlgorandChainConfig(scope)
        return explorerUrl ? `${explorerUrl}/tx/${hash}` : null
    },
    useAutoDraw: useAlgorandCardAutoDraw,
    withdrawal: {
        buildRequest: ({ scope, ...params }) =>
            algorandEscrowWithdrawals.buildRequest({
                ...params,
                network: algorandNetworkOf(scope),
            }),
        buildWithdraw: ({ scope, ...params }) =>
            algorandEscrowWithdrawals.buildWithdraw({
                ...params,
                network: algorandNetworkOf(scope),
            }),
        buildCancel: ({ scope, ...params }) =>
            algorandEscrowWithdrawals.buildCancel({
                ...params,
                network: algorandNetworkOf(scope),
            }),
        getPending: (scope, ownerAddress) =>
            algorandEscrowWithdrawals.getPending(
                algorandNetworkOf(scope),
                ownerAddress,
            ),
        getWaitTimeSeconds: scope =>
            algorandEscrowWithdrawals.getWaitTimeSeconds(
                algorandNetworkOf(scope),
            ),
    },
}
