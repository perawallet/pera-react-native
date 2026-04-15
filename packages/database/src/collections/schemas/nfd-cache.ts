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

/**
 * Collection definition for the NFD (Algorand Name Service) address cache.
 *
 * A `null` `name` represents a negative cache entry — "we looked this
 * address up and it has no NFD" — and is refreshed according to `updatedAt`
 * just like positive entries.
 *
 * Key schema: `${network}:${address}` — matches the `(address, network)`
 * composite primary key the old SQLite schema used.
 */

export type NfdCacheRow = {
    network: string
    address: string
    /** NULL name = negative cache. */
    name: string | null
    image: string | null
    source: string | null
    updatedAt: number
}

export const NFD_CACHE_COLLECTION_NAME = 'nfd_cache'
export const NFD_CACHE_SCHEMA_VERSION = 1

export function nfdCacheKey(row: {
    network: string
    address: string
}): string {
    return `${row.network}:${row.address}`
}
