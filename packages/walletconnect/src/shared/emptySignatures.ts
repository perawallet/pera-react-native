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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { walletConnectSupportFor } from './chainSupport'

/**
 * use-wallet's method for an account's signature shape: public data, so it is
 * answered without prompting the user.
 */
export const GET_EMPTY_SIGNATURES_METHOD = 'algo_getEmptySignatures'

// The spec sends `{ chainId }`; v1 connectors wrap params in an array.
const requestedChainId = (params: unknown): unknown => {
    const body: unknown = Array.isArray(params) ? params[0] : params
    if (typeof body !== 'object' || body === null) return undefined
    return (body as { chainId?: unknown }).chainId
}

/**
 * The answer for `accounts`, or `null` when the request names a chain other
 * than the active network's: rekey state is only tracked for that one.
 */
export const emptySignaturesResult = (
    params: unknown,
    accounts: readonly string[],
    network: Network,
): Nullable<Record<string, string>> => {
    const support = walletConnectSupportFor(network)
    if (!support) return null
    const chainId = requestedChainId(params)
    if (chainId !== undefined && chainId !== support.caip2ChainIdFor(network)) {
        return null
    }
    return support.emptySignaturesFor(accounts)
}
