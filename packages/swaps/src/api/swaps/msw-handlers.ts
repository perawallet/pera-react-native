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
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'
import {
    swapStatusUpdateRequestSchema,
    swapStatusUpdateResponseSchema,
    type SwapStatusUpdateApiResponse,
} from './schema'

export type MockUpdateSwapStatusParams = {
    swapId: string
    response: SwapStatusUpdateApiResponse
    status?: number
}

export const mockUpdateSwapStatus = ({
    swapId,
    response,
    status = 200,
}: MockUpdateSwapStatusParams): HttpHandler => {
    validateMockResponse(
        swapStatusUpdateResponseSchema,
        response,
        'mockUpdateSwapStatus',
    )
    return http.patch(`*/v2/dex-swap/swaps/${swapId}/`, async ({ request }) => {
        const validated = await validateMockRequest(
            swapStatusUpdateRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}
