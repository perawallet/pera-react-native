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

import {
    arc59SendSummaryResponseSchema,
    type Arc59SendSummaryResponse,
} from './schema'

export const fetchArc59SendSummary = async (
    backendUrl: string,
    receiverAddress: string,
    assetId: string,
): Promise<Arc59SendSummaryResponse> => {
    const response = await fetch(
        `${backendUrl}/v1/asa-inboxes/summary/send-flow/${receiverAddress}/${assetId}/`,
    )

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ARC59 send summary: ${response.status}`,
        )
    }

    const data: unknown = await response.json()
    return arc59SendSummaryResponseSchema.parse(data)
}
