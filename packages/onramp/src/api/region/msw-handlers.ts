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

import { rampRegionResponseSchema, type RampRegionApiResponse } from './schema'

export type MockRampRegionParams = {
    response: RampRegionApiResponse
    status?: number
}

export const mockRampRegion = ({
    response,
    status = 200,
}: MockRampRegionParams): HttpHandler => {
    validateMockResponse(rampRegionResponseSchema, response, 'mockRampRegion')
    return http.get('*/v1/ramp/regions', () =>
        HttpResponse.json(response, { status }),
    )
}
