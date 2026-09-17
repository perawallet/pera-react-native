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
import { escrowCardApprovalResponseSchema } from './schema'

export type MockApproveEscrowCardParams = {
    /** Escrow card address AB echoes back as `address`. */
    cardAddress?: string
    status?: number
    /** Captures each request body for assertions. */
    onRequest?: (body: Record<string, unknown>) => void
}

export const mockApproveEscrowCard = ({
    cardAddress = 'MOCKESCROWCARDADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    status = 200,
    onRequest,
}: MockApproveEscrowCardParams = {}): HttpHandler => {
    // AB echoes the stored approval record, keyed by the card address.
    const response = { address: cardAddress }
    validateMockResponse(
        escrowCardApprovalResponseSchema,
        response,
        'mockApproveEscrowCard',
    )
    return http.post('*/api/approvals', async ({ request }) => {
        onRequest?.((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(response, { status })
    })
}
