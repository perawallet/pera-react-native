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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { AnalyticsMetadataKey as Key } from '@analytics'
import type { DiscoverDapp } from '../types'

export type DappEventPayload = {
    [Key.DappName]: string
    [Key.DappUrl]: string
    [Key.ChainId]?: ChainId
}

/** Origin and path only: a typed url's query string and hash may carry user text or secrets. */
export const stripUrlQueryAndHash = (url: string): string => {
    const end = url.search(/[?#]/)
    return end === -1 ? url : url.slice(0, end)
}

/** The payload for a url the user typed; never the query or hash. */
export const typedUrlEventPayload = (dapp: DiscoverDapp): DappEventPayload => ({
    ...dappEventPayload(dapp, null),
    [Key.DappUrl]: stripUrlQueryAndHash(dapp.url),
})

export const dappEventPayload = (
    dapp: DiscoverDapp,
    chain: Nullable<ChainId>,
): DappEventPayload => ({
    [Key.DappName]: dapp.name,
    [Key.DappUrl]: dapp.url,
    ...(chain === null ? {} : { [Key.ChainId]: chain }),
})
