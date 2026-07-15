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
    useFindAccountByAddress,
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
 * - Per-transaction (SingleTransactionScreen): resolves the effective signer
 *   from the transaction's auth address (rekey) or sender.
 * - Group total (TransactionListFooter, no transaction): uses the pipeline's
 *   resolved primary signer account.
 */
export const useQuantumFeeExplainer = (
    transaction?: PeraDisplayableTransaction,
): UseQuantumFeeExplainerResult => {
    const enabled = useIsQuantumAccountsEnabled()
    const { resolved } = useSigningPipeline()

    const signerAddress = transaction
        ? transaction.authAddr?.publicKey
            ? encodeAlgorandAddress(transaction.authAddr.publicKey)
            : transaction.sender
        : ''
    const transactionAccount = useFindAccountByAddress(signerAddress)

    const account = transaction
        ? transactionAccount
        : (resolved?.signerAccount ?? null)

    const isQuantumFee =
        enabled && account !== null && isQuantumAccount(account)

    return { isQuantumFee }
}
