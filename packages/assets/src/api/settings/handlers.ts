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

type ToggleStatusResponse = { is_enabled: boolean }

export type MockToggleAssetFavoriteParams = {
    assetID: string
    response: ToggleStatusResponse
    status?: number
}

export const mockToggleAssetFavorite = ({
    assetID,
    response,
    status = 200,
}: MockToggleAssetFavoriteParams): HttpHandler =>
    http.post(`*/v2/assets/${assetID}/toggle-favorite/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockToggleAssetPriceAlertParams = {
    assetID: string
    response: ToggleStatusResponse
    status?: number
}

export const mockToggleAssetPriceAlert = ({
    assetID,
    response,
    status = 200,
}: MockToggleAssetPriceAlertParams): HttpHandler =>
    http.post(`*/v2/assets/${assetID}/toggle-price-alert/`, () =>
        HttpResponse.json(response, { status }),
    )
