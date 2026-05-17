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
    spotBannerListResponseSchema,
    type SpotBannerListResponse,
} from './schema'

export type MockSpotBannersParams = {
    deviceID: string
    response: SpotBannerListResponse
    status?: number
}

export const mockSpotBanners = ({
    deviceID,
    response,
    status = 200,
}: MockSpotBannersParams): HttpHandler => {
    validateMockResponse(
        spotBannerListResponseSchema,
        response,
        'mockSpotBanners',
    )
    return http.get(`*/v1/devices/${deviceID}/spot-banners/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockCloseSpotBannerParams = {
    deviceID: string
    spotBannerID: number
    status?: number
}

export const mockCloseSpotBanner = ({
    deviceID,
    spotBannerID,
    status = 204,
}: MockCloseSpotBannerParams): HttpHandler =>
    http.patch(
        `*/v1/devices/${deviceID}/spot-banners/${spotBannerID}/close/`,
        () => new HttpResponse(null, { status }),
    )
