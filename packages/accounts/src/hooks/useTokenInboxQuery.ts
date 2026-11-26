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
import { receivesUnaskedAssets } from '../chainProtocol'
import type { AccountHoldingSource, AccountHoldingsLiteRow } from '../db'
import { useAccountAssetsQuery } from './useAccountAssetsQuery'

export type UseTokenInboxQueryResult = {
    holdings: AccountHoldingsLiteRow[]
    isPending: boolean
}

const TOKEN_INBOX_FILTERS = {
    hideNfts: true,
    hideZeroBalance: true,
    onlyAutoHidden: true,
} as const

/**
 * The tokens waiting for the user to accept or reject them: held on a chain
 * that receives tokens unasked, neither verified by Pera nor kept nor hidden.
 */
export const useTokenInboxQuery = (
    sources: readonly AccountHoldingSource[],
): UseTokenInboxQueryResult => {
    const inboxSources = useMemo(
        () =>
            sources.filter(({ scope }) => receivesUnaskedAssets(scope.chainId)),
        [sources],
    )
    const { holdings, isPending } = useAccountAssetsQuery(inboxSources, {
        sortMode: 'alphabeticalAsc',
        filters: TOKEN_INBOX_FILTERS,
    })
    return { holdings, isPending }
}
