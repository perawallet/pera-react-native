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

// No package imports: this module is the service worker's gate, which must
// stay free of the chain graph. Per-chain caps run in the offscreen handler,
// through the chain's dApp request adapter.
import type { JsonRpcRequest } from './codec'
import { MAX_DAPP_REQUEST_JSON_LENGTH } from './protocol'

export const MAX_ID_LENGTH = 64
export const MAX_METHOD_LENGTH = 64

/**
 * Cheap size gate for the service worker, run before a request is forwarded
 * or parked anywhere. The per-chain caps and the full zod validation still run
 * offscreen; this only keeps a hostile page from making the worker hold a
 * multi-megabyte payload while an approval surface opens to show an error.
 */
export const isWithinDappPayloadBounds = (request: JsonRpcRequest): boolean => {
    if (String(request.id).length > MAX_ID_LENGTH) return false
    if (request.method.length > MAX_METHOD_LENGTH) return false
    return JSON.stringify(request).length <= MAX_DAPP_REQUEST_JSON_LENGTH
}
