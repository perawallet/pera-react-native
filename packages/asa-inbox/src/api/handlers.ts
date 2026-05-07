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

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { Arc59SendSummaryResponse } from './schema'

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
}: MockArc59SendSummaryParams): HttpHandler =>
    http.get(
        `*/v1/asa-inboxes/summary/send-flow/${receiverAddress}/${assetId}/`,
        () => HttpResponse.json(response, { status }),
    )

export type MockArc59AssetRequestsParams = {
    address: string
    response: unknown
    status?: number
}

export const mockArc59AssetRequests = ({
    address,
    response,
    status = 200,
}: MockArc59AssetRequestsParams): HttpHandler =>
    http.get(`*/v1/asa-inboxes/requests/${address}/`, () =>
        HttpResponse.json(response, { status }),
    )
