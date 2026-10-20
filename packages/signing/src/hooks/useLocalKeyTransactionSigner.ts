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

import { useKMS } from '@perawallet/wallet-core-kms'
import { useCallback } from 'react'
import { SIGNING_KEY_DOMAIN } from '../constants'
import {
    localKeySignerAdapterFor,
    type LocalSigningFunction,
} from '../chain-adapter'

export type UseLocalKeyTransactionSignerResult = {
    /**
     * Signs the transactions at `indexesToSign` with `account`'s key.
     *
     * The caller is responsible for resolving the correct account before
     * calling: for regular signing flows that means following rekey to the
     * auth account; for multisig cosign that means using the participant's
     * own (un-rekey-resolved) account. This hook signs with whatever account
     * it receives and does NOT follow rekey internally.
     *
     * Do NOT look the account up from the transaction's sender: for multisig
     * cosign and a dApp-named signer, the signer differs from the sender, and
     * lookup-by-sender would either pick the wrong account or none at all.
     */
    signTransactions: LocalSigningFunction
}

/**
 * React binding for the chain's local-key signer: supplies key
 * custody (`useKMS`) and holds no signing logic of its own. The batching, `sgnr` and `pqsig` rules live in the pure
 * pipeline function so they can be proven against a real node.
 */
export const useLocalKeyTransactionSigner =
    (): UseLocalKeyTransactionSignerResult => {
        const { signTransactionsWithKey, getPQSigningInfo } = useKMS()

        const signTransactions = useCallback<LocalSigningFunction>(
            async (transactions, indexesToSign, account, scope) =>
                localKeySignerAdapterFor(scope).signTransactions(
                    {
                        signPayloads: (keyPairId, payloads) =>
                            signTransactionsWithKey(
                                keyPairId,
                                SIGNING_KEY_DOMAIN,
                                payloads,
                            ),
                        getPQSigningInfo,
                    },
                    transactions,
                    indexesToSign,
                    account,
                ),
            [signTransactionsWithKey, getPQSigningInfo],
        )

        return {
            signTransactions,
        }
    }
