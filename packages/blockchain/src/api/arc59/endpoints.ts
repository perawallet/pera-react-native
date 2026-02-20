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

import { Network, queryClient } from '@perawallet/wallet-core-shared'
import {
    arc59SendSummaryResponseSchema,
    type Arc59SendSummaryResponse,
} from './schema'

const getArc59SendSummaryEndpoint = (
    receiverAddress: string,
    assetId: string,
) => `/v1/arc59/send-summary/${receiverAddress}/${assetId}`

export const fetchArc59SendSummary = async (
    network: Network,
    receiverAddress: string,
    assetId: string,
): Promise<Arc59SendSummaryResponse> => {
    const response = await queryClient<Arc59SendSummaryResponse>({
        backend: 'pera',
        network: network,
        method: 'GET',
        url: getArc59SendSummaryEndpoint(receiverAddress, assetId),
    })  

    return arc59SendSummaryResponseSchema.parse(response.data)
}
