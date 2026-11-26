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

import { useMemo } from 'react'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import {
    useSyncRefreshAll,
    type UseSyncRefreshResult,
} from '@hooks/useSyncRefresh'

/** A user refresh of each source's own address on its own network. */
export const useHoldingSourcesRefresh = (
    sources: readonly AccountHoldingSource[],
): UseSyncRefreshResult =>
    useSyncRefreshAll(
        useMemo(
            () =>
                sources.map(({ address, scope }) => ({
                    addresses: [address],
                    scope,
                })),
            [sources],
        ),
        { isUserRefresh: true },
    )
