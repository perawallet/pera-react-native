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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    swapStatusUpdateResponseSchema,
    type SwapStatusUpdateRequest,
    type SwapStatusUpdateApiResponse,
} from './schema'
import type { SwapStatusUpdateResult } from '../../models'

export const updateSwapStatus = async (
    swapId: string,
    data: SwapStatusUpdateRequest,
    network: Network,
): Promise<SwapStatusUpdateResult> => {
    const response = await queryClient<SwapStatusUpdateApiResponse>({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: `/v2/dex-swap/swaps/${swapId}/`,
        data,
    })

    const parsed = swapStatusUpdateResponseSchema.parse(response.data)
    return {
        status: parsed.status,
        submittedTransactionIds: parsed.submitted_transaction_ids,
        reason: parsed.reason,
        appVersion: parsed.app_version,
        platform: parsed.platform,
        countryCode: parsed.country_code,
        swapVersion: parsed.swap_version,
    }
}
