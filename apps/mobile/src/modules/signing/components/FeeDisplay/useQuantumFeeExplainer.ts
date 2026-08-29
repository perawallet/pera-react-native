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
    isQuantumAccount,
    useSignerFor,
} from '@perawallet/wallet-core-accounts'
import {
    encodeAlgorandAddress,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'

type UseQuantumFeeExplainerResult = {
    isQuantumFee: boolean
}

/**
 * Decides whether the quantum-fee explainer affordance should appear next to a
 * rendered transaction fee. The fee is higher for Quantum accounts, so the
 * explainer only shows when the effective signer is a Quantum account.
 *
 * Resolve the authorizer exactly as the fee is priced
 * (`assignMinimumFeesToGroup` → `getSignerFor`): ARC-0001 authAddr override,
 * else the sender, then one rekey hop. Reading the authorizer's own type makes
 * the copy contradict the fee once an account is rekeyed across the quantum
 * boundary — a rekeyed-away Quantum account pays 0.001.
 *
 * - Per-transaction (SingleTransactionScreen): resolves from the transaction.
 * - Group total (TransactionListFooter, no transaction): uses the pipeline's
 *   resolved primary signer address.
 */
export const useQuantumFeeExplainer = (
    transaction?: PeraDisplayableTransaction,
): UseQuantumFeeExplainerResult => {
    const enabled = useIsQuantumAccountsEnabled()
    const { resolved } = useSigningPipeline()

    const authorizerAddress = transaction
        ? transaction.authAddr?.publicKey
            ? encodeAlgorandAddress(transaction.authAddr.publicKey)
            : transaction.sender
        : resolved?.signerAccount.address

    const signer = useSignerFor(authorizerAddress)

    const isQuantumFee = enabled && signer !== null && isQuantumAccount(signer)

    return { isQuantumFee }
}
