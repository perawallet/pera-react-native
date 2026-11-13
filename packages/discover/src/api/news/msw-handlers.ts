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
    newsDetailResponseSchema,
    newsListResponseSchema,
    type NewsDetailApiResponse,
    type NewsListApiResponse,
} from './schema'

export type MockDiscoverNewsParams = {
    response: NewsListApiResponse
    status?: number
}

export const mockDiscoverNews = ({
    response,
    status = 200,
}: MockDiscoverNewsParams): HttpHandler => {
    validateMockResponse(newsListResponseSchema, response, 'mockDiscoverNews')
    return http.get('*/v1/discover/news/', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockDiscoverNewsDetailParams = {
    id: string
    response: NewsDetailApiResponse
    status?: number
}

export const mockDiscoverNewsDetail = ({
    id,
    response,
    status = 200,
}: MockDiscoverNewsDetailParams): HttpHandler => {
    validateMockResponse(
        newsDetailResponseSchema,
        response,
        'mockDiscoverNewsDetail',
    )
    return http.get(`*/v1/discover/news/${encodeURIComponent(id)}/`, () =>
        HttpResponse.json(response, { status }),
    )
}
