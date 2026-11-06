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

import { useCallback, useMemo } from 'react'
import {
    addressOn,
    canHideHolding,
    hiddenAssetIdsOf,
    receivesUnaskedAssets,
    useAccountAssetsQuery,
    useAccountHoldingSources,
    useHiddenTokensStore,
    useSelectedAccount,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'

const HIDEABLE_FILTERS = { hideNfts: true }
// What the asset list reads while "Show suspicious assets" is off.
const LISTED_FILTERS = { hideNfts: true, hideSuspicious: true }
const NO_KEYS: ReadonlySet<string> = new Set()

const rowKey = ({ scope, assetId }: AccountHoldingsLiteRow): string =>
    `${scope.chainId}/${scope.networkId}/${assetId}`

export type HideTokensListItem =
    | { kind: 'header'; id: 'shown' | 'hidden'; title: string }
    | { kind: 'token'; row: AccountHoldingsLiteRow }

type UseHideTokensScreenResult = {
    items: HideTokensListItem[]
    isPending: boolean
    /** The account is on more than one chain that receives unasked assets, so each row names its network. */
    showsNetwork: boolean
    isRowHidden: (row: AccountHoldingsLiteRow) => boolean
    /** Kept out by the suspicious filter, not by the user: there is nothing to hide or unhide until that switch is on. */
    isRowLocked: (row: AccountHoldingsLiteRow) => boolean
    handleToggleHidden: (row: AccountHoldingsLiteRow) => void
    t: (key: string, params?: Record<string, string | number>) => string
}

export const useHideTokensScreen = (): UseHideTokensScreenResult => {
    const { t } = useLanguage()
    const account = useSelectedAccount()
    const holdingSources = useAccountHoldingSources(account)
    const sources = useMemo(
        () =>
            holdingSources.filter(({ scope }) =>
                receivesUnaskedAssets(scope.chainId),
            ),
        [holdingSources],
    )
    const showSuspicious = useAssetPreferencesStore(
        state => state.showSuspicious,
    )
    // Suspicious and zero-balance tokens are as hideable as any; NFTs are not,
    // as the collectibles gallery never reads the hidden set.
    const { holdings, isPending: isHoldingsPending } = useAccountAssetsQuery(
        sources,
        { sortMode: 'alphabeticalAsc', filters: HIDEABLE_FILTERS },
    )
    // Rows the list read below lacks are the ones the suspicious filter drops,
    // found in SQL rather than by parsing every row's metadata.
    const { holdings: listed, isPending: isListedPending } =
        useAccountAssetsQuery(sources, {
            sortMode: 'alphabeticalAsc',
            filters: LISTED_FILTERS,
            enabled: !showSuspicious,
        })
    const isPending = isHoldingsPending || isListedPending
    const hiddenTokens = useHiddenTokensStore(state => state.hiddenTokens)
    const setTokenHidden = useHiddenTokensStore(state => state.setTokenHidden)

    const isRowHidden = useCallback(
        (row: AccountHoldingsLiteRow) => {
            const address = account ? addressOn(account, row.scope) : undefined
            return (
                address !== undefined &&
                hiddenAssetIdsOf(hiddenTokens, address, row.scope).includes(
                    row.assetId,
                )
            )
        },
        [account, hiddenTokens],
    )

    const filteredKeys = useMemo(() => {
        if (showSuspicious) return NO_KEYS
        const listedKeys = new Set(listed.map(rowKey))
        return new Set(holdings.map(rowKey).filter(key => !listedKeys.has(key)))
    }, [showSuspicious, holdings, listed])

    const isRowLocked = useCallback(
        (row: AccountHoldingsLiteRow) =>
            filteredKeys.has(rowKey(row)) && !isRowHidden(row),
        [filteredKeys, isRowHidden],
    )

    const items = useMemo<HideTokensListItem[]>(() => {
        const rows = holdings.filter(row =>
            canHideHolding(row.scope.chainId, row.assetId),
        )
        const section = (
            id: 'shown' | 'hidden',
            titleKey: string,
            sectionRows: AccountHoldingsLiteRow[],
        ): HideTokensListItem[] =>
            sectionRows.length === 0
                ? []
                : [
                      { kind: 'header', id, title: t(titleKey) },
                      ...sectionRows.map((row): HideTokensListItem => ({
                          kind: 'token',
                          row,
                      })),
                  ]
        return [
            ...section(
                'shown',
                'hide_tokens.tokens_section',
                rows.filter(
                    row => !isRowHidden(row) && !filteredKeys.has(rowKey(row)),
                ),
            ),
            ...section(
                'hidden',
                'hide_tokens.hidden_section',
                rows.filter(
                    row => isRowHidden(row) || filteredKeys.has(rowKey(row)),
                ),
            ),
        ]
    }, [holdings, isRowHidden, filteredKeys, t])

    const handleToggleHidden = useCallback(
        (row: AccountHoldingsLiteRow) => {
            const address = account ? addressOn(account, row.scope) : undefined
            if (address === undefined || isRowLocked(row)) return
            setTokenHidden({
                address,
                scope: row.scope,
                assetId: row.assetId,
                isHidden: !isRowHidden(row),
            })
        },
        [account, isRowHidden, isRowLocked, setTokenHidden],
    )

    return {
        items,
        isPending,
        showsNetwork: sources.length > 1,
        isRowHidden,
        isRowLocked,
        handleToggleHidden,
        t,
    }
}
