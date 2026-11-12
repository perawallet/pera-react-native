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
    useFindAccountByAddress,
    useSignerFor,
    usesNonPrimaryScheme,
} from '@perawallet/wallet-core-accounts'
import { isPostQuantumScheme } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    encodeAlgorandAddress,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useSigningPipeline } from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useCapability } from '@hooks/useCapability'

type UseQuantumFeeExplainerResult = {
    isQuantumFee: boolean
}

/**
 * Decides whether the quantum-fee explainer affordance should appear next to a
 * rendered transaction fee. The fee is higher for Quantum accounts, so the
 * explainer only shows when the key that signs is a Quantum key.
 *
 * Resolved as the fee is priced (`signingAccountFor`): a named `authAddr`
 * signs with its own key, never its rekey; otherwise the sender's signer, one
 * rekey hop away. Reading the sender's own type instead makes the copy
 * contradict the fee once an account is rekeyed across the quantum boundary.
 *
 * - Per-transaction (SingleTransactionScreen): resolves from the transaction.
 * - Group total (TransactionListFooter, no transaction): reads the credentials
 *   the signing pipeline resolved for its groups.
 */
export const useQuantumFeeExplainer = (
    transaction?: AlgorandTransactionView,
): UseQuantumFeeExplainerResult => {
    // Platform part only: an existing quantum account still pays the premium
    // after remote config switches `quantumAccounts` off.
    const enabled = useCapability({ platform: 'quantum' })
    const { resolved } = useSigningPipeline()
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)

    const namedSigner = transaction?.authAddr?.publicKey
        ? encodeAlgorandAddress(transaction.authAddr.publicKey)
        : undefined
    const namedAccount = useFindAccountByAddress(namedSigner ?? '', scope)
    const senderSigner = useSignerFor(
        namedSigner === undefined ? transaction?.sender : undefined,
        ALGORAND_CHAIN_ID,
    )

    if (!enabled) return { isQuantumFee: false }

    if (!transaction) {
        const credentials = [...(resolved?.groupSigners.values() ?? [])]
        return {
            isQuantumFee: credentials.some(credential =>
                isPostQuantumScheme(credential.scheme),
            ),
        }
    }

    const signer = namedSigner === undefined ? senderSigner : namedAccount
    return {
        isQuantumFee:
            !!signer && usesNonPrimaryScheme(signer, ALGORAND_CHAIN_ID),
    }
}
