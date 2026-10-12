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

import { useCallback } from 'react'
import type { Arc0001WalletTransaction } from '@perawallet/wallet-core-chain-contract'
import type { EnqueueTransactionSigning } from '@perawallet/wallet-core-connections'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../chain-id'

/**
 * Algorand's `DappRequestChainAdapter.useEnqueueTransactionSigning`. Resolves
 * the wire group against the wallet's own accounts and hands the result to
 * the signing pipeline. Not declared `async`: `resolve` throws synchronously
 * on an ARC-0001 violation (bad base64, an unauthorized signer, a multisig
 * slot...), and that throw must reach the caller synchronously too, before
 * anything is queued — an `async` wrapper would flatten it into a rejected
 * Promise instead.
 */
export const useAlgorandTransactionSigning = (): EnqueueTransactionSigning => {
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const resolve = useArc0001Resolver(scope)
    const enqueue = useEnqueueArc0001SignRequest(scope)

    return useCallback(
        (request, transport) => {
            const resolved = resolve(
                { transactions: request.group as Arc0001WalletTransaction[] },
                { authorizedAddresses: new Set(request.authorizedAccounts) },
            )
            return enqueue(resolved, transport)
        },
        [resolve, enqueue],
    )
}
