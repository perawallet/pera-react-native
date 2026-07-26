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

import type { CardResponseType, CardTransportResponse } from './types'

// ky's prefix join rejects a leading slash on the path.
export const toKyPath = (path: string): string =>
    path.startsWith('/') ? path.slice(1) : path

// Decode a fetch Response into a CardTransportResponse by the requested body
// type. The default (json) reads text first and only JSON.parses a non-empty
// body — ky's response.json() throws "Unexpected end of input" on 204 / empty
// 200 responses.
export const parseResponse = async <TData>(
    response: Response,
    responseType?: CardResponseType,
): Promise<CardTransportResponse<TData>> => {
    let data: TData
    switch (responseType ?? 'json') {
        case 'text': {
            data = (await response.text()) as unknown as TData
            break
        }
        case 'blob': {
            data = (await response.blob()) as unknown as TData
            break
        }
        case 'arraybuffer': {
            data = (await response.arrayBuffer()) as unknown as TData
            break
        }
        default: {
            const text = await response.text()
            data = (text.trim() ? JSON.parse(text) : undefined) as TData
        }
    }
    return { data, status: response.status, statusText: response.statusText }
}
