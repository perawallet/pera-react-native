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

const MODULE_PREFIX = 'transactions'

/**
 * Query key factory for transaction history queries.
 */
export const transactionQueryKeys = {
    all: [MODULE_PREFIX] as const,

    history: (accountAddress: string) =>
        [MODULE_PREFIX, 'history', { accountAddress }] as const,

    historyWithFilters: (
        accountAddress: string,
        filters: {
            assetId?: number
            afterTime?: string
            beforeTime?: string
            limit?: number
        },
    ) => [MODULE_PREFIX, 'history', { accountAddress, ...filters }] as const,

    paginatedHistory: (accountAddress: string, url: string) =>
        [MODULE_PREFIX, 'history', 'page', { accountAddress, url }] as const,
}
