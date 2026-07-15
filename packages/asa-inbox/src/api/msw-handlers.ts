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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    arc59AssetRequestsResponseSchema,
    arc59SendSummaryResponseSchema,
    type Arc59SendSummaryResponse,
    type Arc59AssetRequestsResponse,
} from './schema'

export type MockArc59SendSummaryParams = {
    receiverAddress: string
    assetId: string
    response: Arc59SendSummaryResponse
    status?: number
}

export const mockArc59SendSummary = ({
    receiverAddress,
    assetId,
    response,
    status = 200,
}: MockArc59SendSummaryParams): HttpHandler => {
    validateMockResponse(
        arc59SendSummaryResponseSchema,
        response,
        'mockArc59SendSummary',
    )
    return http.get(
        `*/v1/asa-inboxes/summary/send-flow/${receiverAddress}/${assetId}/`,
        () => HttpResponse.json(response, { status }),
    )
}

export type MockArc59AssetRequestsParams = {
    address: string
    response: Arc59AssetRequestsResponse
    status?: number
}

export const mockArc59AssetRequests = ({
    address,
    response,
    status = 200,
}: MockArc59AssetRequestsParams): HttpHandler => {
    validateMockResponse(
        arc59AssetRequestsResponseSchema,
        response,
        'mockArc59AssetRequests',
    )
    return http.get(`*/v1/asa-inboxes/requests/${address}/`, () =>
        HttpResponse.json(response, { status }),
    )
}
