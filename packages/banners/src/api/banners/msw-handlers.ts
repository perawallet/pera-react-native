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
import type { z } from 'zod'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import { bannerListResponseSchema } from './schema'

export type MockBannersParams = {
    deviceID: string
    // wire (pre-parse) shape: ids may be numbers or strings
    response: z.input<typeof bannerListResponseSchema>
    status?: number
}

export const mockBanners = ({
    deviceID,
    response,
    status = 200,
}: MockBannersParams): HttpHandler => {
    validateMockResponse(bannerListResponseSchema, response, 'mockBanners')
    return http.get(`*/v1/devices/${deviceID}/banners/`, () =>
        HttpResponse.json(response, { status }),
    )
}
