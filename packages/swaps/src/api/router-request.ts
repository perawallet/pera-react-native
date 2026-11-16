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

import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    queryClient,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export const SWAP_ROUTER_PATH = '/api/v4/swap/'

type RouterRequest = {
    scope: ChainScope
    method: 'GET' | 'POST' | 'PATCH'
    /** Relative to the router root, with a trailing slash. */
    path: string
    params?: Record<string, string | number>
    data?: unknown
}

// Every router route sits behind the app-integrity guard.
export const routerRequest = async ({
    scope,
    method,
    path,
    params,
    data,
}: RouterRequest): Promise<unknown> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        scope,
        method,
        url: `${SWAP_ROUTER_PATH}${path}`,
        headers: await buildIntegrityHeadersWhenReady(),
        ...(params ? { params } : {}),
        ...(data !== undefined ? { data } : {}),
    })
    return response.data
}

/** Pages carry `next` as a full URL or a bare cursor; either way, the cursor. */
export const cursorOf = (next: Maybe<string>): Nullable<string> => {
    if (!next) return null
    try {
        return new URL(next).searchParams.get('cursor')
    } catch {
        return next
    }
}
