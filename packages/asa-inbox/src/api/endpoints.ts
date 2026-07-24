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

import { type Network, queryClient } from '@perawallet/wallet-core-shared'
import {
    arc59SendSummaryResponseSchema,
    arc59AssetRequestsResponseSchema,
    mapArc59AssetRequest,
    type Arc59SendSummaryResponse,
    type Arc59AssetRequest,
} from './schema'

const getArc59SendSummaryEndpoint = (
    receiverAddress: string,
    assetId: string,
) => `/v1/asa-inboxes/summary/send-flow/${receiverAddress}/${assetId}/`

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

const getArc59AssetRequestsEndpoint = (address: string) =>
    `/v1/asa-inboxes/requests/${address}/`

export const fetchArc59AssetRequests = async (
    network: Network,
    address: string,
): Promise<Arc59AssetRequest[]> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        network: network,
        method: 'GET',
        url: getArc59AssetRequestsEndpoint(address),
    })

    const parsed = arc59AssetRequestsResponseSchema.parse(response.data)
    const inboxAddress = parsed.inbox_address ?? null
    return parsed.results.map(raw => mapArc59AssetRequest(raw, inboxAddress))
}
