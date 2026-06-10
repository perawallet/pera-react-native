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
import {
    assetResponseSchema,
    assetsResponseSchema,
    indexerAssetResponseSchema,
    publicAssetResponseSchema,
} from './schema'

// Mock payloads are typed with the schema *input* (wire) shape, not the
// parsed output — e.g. asset ids may be numbers on the wire but are
// normalized to strings by `uint64IdSchema` during parsing.
export type MockAssetsParams = {
    response: z.input<typeof assetsResponseSchema>
    status?: number
}

export const mockAssets = ({
    response,
    status = 200,
}: MockAssetsParams): HttpHandler => {
    validateMockResponse(assetsResponseSchema, response, 'mockAssets')
    return http.get('*/v1/assets/', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockAccountAssetsParams = {
    address: string
    response: z.input<typeof assetsResponseSchema>
    status?: number
}

export const mockAccountAssets = ({
    address,
    response,
    status = 200,
}: MockAccountAssetsParams): HttpHandler => {
    validateMockResponse(assetsResponseSchema, response, 'mockAccountAssets')
    return http.get(`*/v2/accounts/${address}/assets/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockAssetDetailsParams = {
    assetID: string
    response: z.input<typeof assetResponseSchema>
    status?: number
}

export const mockAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockAssetDetailsParams): HttpHandler => {
    validateMockResponse(assetResponseSchema, response, 'mockAssetDetails')
    return http.get(`*/v1/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockPublicAssetDetailsParams = {
    assetID: string
    response: z.input<typeof publicAssetResponseSchema>
    status?: number
}

export const mockPublicAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockPublicAssetDetailsParams): HttpHandler => {
    validateMockResponse(
        publicAssetResponseSchema,
        response,
        'mockPublicAssetDetails',
    )
    return http.get(`*/v1/public/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockIndexerAssetDetailsParams = {
    assetID: string
    response: z.input<typeof indexerAssetResponseSchema>
    status?: number
}

export const mockIndexerAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockIndexerAssetDetailsParams): HttpHandler => {
    validateMockResponse(
        indexerAssetResponseSchema,
        response,
        'mockIndexerAssetDetails',
    )
    return http.get(`*/v2/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )
}
