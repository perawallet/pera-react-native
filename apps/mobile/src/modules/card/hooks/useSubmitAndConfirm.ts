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
import {
    useAlgorandClient,
    waitForTransactionConfirmation,
} from '@perawallet/wallet-core-blockchain'
import {
    useSignAndSubmitGroup,
    type SignAndSubmitGroupParams,
} from '@perawallet/wallet-core-signing'

/**
 * Signs and submits like `useSignAndSubmitGroup`, then holds until the group
 * is in a block. The card flows invalidate chain-backed queries (escrow
 * balance, pending withdrawal box) right after submitting, and those reads
 * only change once the transaction has landed.
 */
export const useSubmitAndConfirm = () => {
    const algokit = useAlgorandClient()
    const { submit } = useSignAndSubmitGroup()

    return useCallback(
        async (
            params: SignAndSubmitGroupParams,
        ): Promise<{ txIds: string[] }> => {
            const result = await submit(params)
            const [txId] = result.txIds
            if (txId !== undefined) {
                await waitForTransactionConfirmation(algokit.client.algod, txId)
            }
            return result
        },
        [submit, algokit],
    )
}
