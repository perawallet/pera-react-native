/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    prepareTransactionsResponseSchema,
    type PrepareTransactionsRequest,
    type PrepareTransactionsApiResponse,
} from './schema'
import type { PrepareTransactionsResult } from '../../models'

export const prepareTransactions = async (
    data: PrepareTransactionsRequest,
    network: Network,
): Promise<PrepareTransactionsResult> => {
    const response = await queryClient<PrepareTransactionsApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v2/dex-swap/prepare-transactions/`,
        data,
    })

    const parsed = prepareTransactionsResponseSchema.parse(response.data)
    return {
        transactionGroups: parsed.transaction_groups?.map(group => ({
            purpose: group.purpose,
            transactionGroupId: group.transaction_group_id,
            transactions: group.transactions,
            signedTransactions: group.signed_transactions,
        })),
        swapId: parsed.swap_id,
        swapIdStr: parsed.swap_id_str,
        swapVersion: parsed.swap_version,
    }
}
