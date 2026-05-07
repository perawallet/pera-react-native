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
import type {
    AssetResponse,
    AssetsResponse,
    IndexerAssetResponse,
    PublicAssetResponse,
} from './schema'

export type MockAssetsParams = {
    response: AssetsResponse
    status?: number
}

export const mockAssets = ({
    response,
    status = 200,
}: MockAssetsParams): HttpHandler =>
    http.get('*/v1/assets/', () => HttpResponse.json(response, { status }))

export type MockAccountAssetsParams = {
    address: string
    response: AssetsResponse
    status?: number
}

export const mockAccountAssets = ({
    address,
    response,
    status = 200,
}: MockAccountAssetsParams): HttpHandler =>
    http.get(`*/v2/accounts/${address}/assets/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockAssetDetailsParams = {
    assetID: string
    response: AssetResponse
    status?: number
}

export const mockAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockAssetDetailsParams): HttpHandler =>
    http.get(`*/v1/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockPublicAssetDetailsParams = {
    assetID: string
    response: PublicAssetResponse
    status?: number
}

export const mockPublicAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockPublicAssetDetailsParams): HttpHandler =>
    http.get(`*/v1/public/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockIndexerAssetDetailsParams = {
    assetID: string
    response: IndexerAssetResponse
    status?: number
}

export const mockIndexerAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockIndexerAssetDetailsParams): HttpHandler =>
    http.get(`*/v2/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )
