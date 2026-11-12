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

import { isValidAddress } from 'algosdk'
import { toUnsignedAlgorandTransactions } from '../signing/unsignedTransaction'
import { toAlgodError, waitForTransactionConfirmation } from '../blockchain'
import {
    canSignProgram,
    hasCustody,
    isDelegatedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId } from '@perawallet/wallet-core-assets'
import {
    CardEscrowNotConfiguredError,
    type CardChainAdapter,
} from '@perawallet/wallet-core-card'
import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import {
    algorandAddressOf,
    canSignArc60,
    isQuantumAccount,
} from '../accounts/vocabulary'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../network-id'
import { cardAlgorandClient } from './client'
import {
    algorandDelegationRequests,
    BAANX_ALGORAND_NETWORK,
} from './delegation'
import { getAlgorandCardOwner } from './escrow/cards'
import { algorandAutoDraw } from './escrow/killswitch'
import { resolveEscrowChainConfig } from './escrow/lsig'
import { algorandEscrowWithdrawals } from './escrow/withdrawal'
import { buildAlgorandManualDeposit } from './manualDeposit'
import { useAlgorandCardAutoDraw } from './useAlgorandCardAutoDraw'

// Both mean the same thing to the user: the account can't cover the fee and
// keep its minimum balance.
const INSUFFICIENT_BALANCE_CODES: ReadonlySet<string> = new Set([
    'below_min_balance',
    'overspend',
])

// The card's ownership proof and AutoDraw delegation are Ed25519 signatures,
// so a quantum (Falcon) key can't back the card.
const holdsCardSigningKey = (account: WalletAccount): boolean =>
    algorandAddressOf(account) !== undefined &&
    (hasCustody(account, 'hardware') ||
        (hasCustody(account, 'local') && !isQuantumAccount(account)))

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
    buildManualDeposit: async (params, scope) => {
        const assetId = settlementAsset(scope)
        if (assetId === null) {
            throw new CardEscrowNotConfiguredError()
        }
        return toUnsignedAlgorandTransactions(
            await buildAlgorandManualDeposit(
                { ...params, assetId },
                algorandNetworkOf(scope),
            ),
            scope,
        )
    },
    // A rekeyed account's authority sits elsewhere, so the card contract can't
    // draw from it. Ledger signs the sign-in proof on-device but its firmware
    // never signs a program.
    fundingSourceEligibility: account => ({
        canFund:
            holdsCardSigningKey(account) &&
            !isDelegatedAccount(account, ALGORAND_CHAIN_ID),
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
    isAutoDrawEnabled: async (scope, ownerAddress) => {
        if (settlementAsset(scope) === null) return false
        const network = algorandNetworkOf(scope)
        if (!algorandAutoDraw.isConfigured(network)) return false
        return algorandAutoDraw.isEnabled({
            network,
            sender: ownerAddress,
            asset: resolveEscrowChainConfig(network).assetId,
        })
    },
    // Baanx can hold several registered wallets, and on other chains too.
    findCardOwner: async (scope, registeredWallets) => {
        if (settlementAsset(scope) === null) return null
        const network = algorandNetworkOf(scope)
        for (const wallet of registeredWallets) {
            if (
                wallet.network.trim().toLowerCase() !==
                    BAANX_ALGORAND_NETWORK ||
                !isValidAddress(wallet.address)
            ) {
                continue
            }
            const owner = await getAlgorandCardOwner(network, wallet.address)
            if (owner !== null) return owner
        }
        return null
    },
    useAutoDraw: useAlgorandCardAutoDraw,
    withdrawal: {
        buildRequest: async ({ scope, ...params }) =>
            toUnsignedAlgorandTransactions(
                await algorandEscrowWithdrawals.buildRequest({
                    ...params,
                    network: algorandNetworkOf(scope),
                }),
                scope,
            ),
        buildWithdraw: async ({ scope, ...params }) =>
            toUnsignedAlgorandTransactions(
                await algorandEscrowWithdrawals.buildWithdraw({
                    ...params,
                    network: algorandNetworkOf(scope),
                }),
                scope,
            ),
        buildCancel: async ({ scope, ...params }) =>
            toUnsignedAlgorandTransactions(
                await algorandEscrowWithdrawals.buildCancel({
                    ...params,
                    network: algorandNetworkOf(scope),
                }),
                scope,
            ),
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
