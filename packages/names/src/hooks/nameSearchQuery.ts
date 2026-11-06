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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchNameSearch } from '../api'
import { nameQueryKeys } from './querykeys'
import type { NameSearchResult } from '../models'

// Shared by every search hook, so one search per name and scope is cached once.
export const nameSearchQueryOptions = (
    scope: ChainScope,
    normalizedName: string,
) => ({
    queryKey: nameQueryKeys.search(normalizedName, scope),
    queryFn: ({
        signal,
    }: {
        signal?: AbortSignal
    }): Promise<NameSearchResult[]> =>
        fetchNameSearch({ name: normalizedName, scope, signal }),
})
