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
import type { AssetPricesResponse, AssetPriceHistoryResponse } from './schema'

// Note: the asset prices endpoint shares its path with `mockAssets` (both hit
// `/v1/assets/`). Tests that need both should register the more specific
// handler first (MSW resolves in registration order). For most flows you'll
// want only one of them registered per test.
export type MockAssetPricesParams = {
    response: AssetPricesResponse
    status?: number
}

export const mockAssetPrices = ({
    response,
    status = 200,
}: MockAssetPricesParams): HttpHandler =>
    http.get('*/v1/assets/', () => HttpResponse.json(response, { status }))

export type MockAssetPriceHistoryParams = {
    response: AssetPriceHistoryResponse
    status?: number
}

export const mockAssetPriceHistory = ({
    response,
    status = 200,
}: MockAssetPriceHistoryParams): HttpHandler =>
    http.get('*/v1/assets/price-chart/', () =>
        HttpResponse.json(response, { status }),
    )
