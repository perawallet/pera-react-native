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
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    internalWalletsResponseSchema,
    type InternalWalletApiResponse,
} from './schema'

export type MockGetInternalWalletsParams = {
    response: InternalWalletApiResponse[]
    status?: number
}

export const mockGetInternalWallets = ({
    response,
    status = 200,
}: MockGetInternalWalletsParams): HttpHandler => {
    validateMockResponse(
        internalWalletsResponseSchema,
        response,
        'mockGetInternalWallets',
    )
    return http.get('*/v1/wallet/internal', () =>
        HttpResponse.json(response, { status }),
    )
}

export const mockWithdrawFromWallet = (status = 200): HttpHandler =>
    http.post('*/v1/wallet/internal/withdraw', () =>
        HttpResponse.json({ success: status < 400 }, { status }),
    )
