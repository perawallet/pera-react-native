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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useSignAndSubmitGroup,
    type SignAndSubmitGroupParams,
} from '@perawallet/wallet-core-signing'
import { cardAdapterFor } from '../chain-adapter'

/**
 * Signs and submits like `useSignAndSubmitGroup`, then holds until the group
 * is in a block. The card flows invalidate chain-backed queries (escrow
 * balance, pending withdrawal box) right after submitting, and those reads
 * only change once the transaction has landed.
 */
export const useSubmitAndConfirmMutation = () => {
    const { network } = useNetwork()
    const { submit } = useSignAndSubmitGroup()

    return useMutation<{ txIds: string[] }, Error, SignAndSubmitGroupParams>({
        mutationFn: async params => {
            const result = await submit(params)
            const [txId] = result.txIds
            if (txId !== undefined) {
                await cardAdapterFor(network).awaitConfirmation(network, txId)
            }
            return result
        },
        // A retry would sign and broadcast the group a second time.
        retry: false,
        throwOnError: false,
    })
}
