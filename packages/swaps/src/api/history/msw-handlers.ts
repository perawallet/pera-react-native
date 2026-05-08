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
    SwapHistoryApiResponse,
    SwapDistinctPairsHistoryApiResponse,
} from './schema'

export type MockSwapHistoryParams = {
    response: SwapHistoryApiResponse
    status?: number
}

export const mockSwapHistory = ({
    response,
    status = 200,
}: MockSwapHistoryParams): HttpHandler =>
    http.get('*/v2/dex-swap/history/', () =>
        HttpResponse.json(response, { status }),
    )

export type MockDistinctPairsHistoryParams = {
    response: SwapDistinctPairsHistoryApiResponse
    status?: number
}

export const mockDistinctPairsHistory = ({
    response,
    status = 200,
}: MockDistinctPairsHistoryParams): HttpHandler =>
    http.get('*/v2/dex-swap/distinct-pairs-history/', () =>
        HttpResponse.json(response, { status }),
    )
