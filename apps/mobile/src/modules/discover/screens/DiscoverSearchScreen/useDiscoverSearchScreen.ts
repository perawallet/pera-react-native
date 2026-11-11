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

import { useCallback, useMemo, useState } from 'react'
import {
    useAssetSearchAcrossScopesQuery,
    type ScopedAssetSearchResult,
} from '@perawallet/wallet-core-assets'
import { useSelectedScopes } from '@perawallet/wallet-core-chain-shared'
import {
    logger,
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    AnalyticsMetadataKey as Key,
    DiscoverEvent,
    trackEvent,
} from '@analytics'
import { toValidatedBrowserUrl } from '@modules/webview'
import type { FilterOption } from '@components/FilterSelection'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapableChainIds } from '@hooks/useCapableChainIds'
import { useLanguage } from '@hooks/useLanguage'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import { useDiscoverChainIds } from '../../hooks/useDiscoverChainIds'
import { useDiscoverDirectory } from '../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import {
    useDiscoverRecentSearchesStore,
    type RecentSearch,
} from '../../store/useDiscoverRecentSearchesStore'
import type { DiscoverDapp } from '../../types'
import { dappEventPayload } from '../../utils/discoverAnalytics'
import { filterDappsByQuery } from '../../utils/filterDappsByQuery'
import { looksLikeUrl } from '../../utils/looksLikeUrl'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'
import { dappFromUrl } from '../../utils/toDiscoverDapp'

const WEB_SEARCH_URL_PREFIX = 'https://duckduckgo.com/?q='

export type DiscoverSearchFilter = 'all' | 'markets' | 'dapps'

export type UseDiscoverSearchScreenResult = {
    query: string
    setQuery: (q: string) => void
    filter: DiscoverSearchFilter
    setFilter: (f: DiscoverSearchFilter) => void
    filterOptions: FilterOption<DiscoverSearchFilter>[]
    isTyping: boolean
    /** True while the typed text has not yet reached the searches. */
    isDebouncing: boolean
    typedUrl: Nullable<string>
    isWebSearchRowVisible: boolean
    dappResults: DiscoverDapp[]
    assetResults: ScopedAssetSearchResult[]
    showChains: boolean
    isLoadingDapps: boolean
    isLoadingAssets: boolean
    isAssetSearchIncomplete: boolean
    isAssetSearchUnavailable: boolean
    recents: RecentSearch[]
    isFavorite: (url: string) => boolean
    isVerified: (url: string) => boolean
    submit: () => void
    openTypedUrl: () => void
    openWebSearch: () => void
    openDapp: (d: DiscoverDapp) => void
    openAsset: (r: ScopedAssetSearchResult) => void
    openRecent: (r: RecentSearch) => void
    toggleFavorite: (d: DiscoverDapp) => void
    toggleTypedUrlFavorite: () => void
    removeRecent: (key: string) => void
    clearRecents: () => void
    cancel: () => void
}

export const useDiscoverSearchScreen = (): UseDiscoverSearchScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { openDapp: openDappPage, openWebPage } = useOpenDapp()
    const toggle = useToggleDiscoverFavorite()
    const directory = useDiscoverDirectory()
    const discoverChainIds = useDiscoverChainIds()
    const scopes = useSelectedScopes(useCapableChainIds('assetSearch'))
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    const recents = useDiscoverRecentSearchesStore(s => s.items)
    const pushRecent = useDiscoverRecentSearchesStore(s => s.push)
    const removeRecent = useDiscoverRecentSearchesStore(s => s.remove)
    const clearRecents = useDiscoverRecentSearchesStore(s => s.clear)

    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState<DiscoverSearchFilter>('all')
    const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_TIME)
    const isTyping = query.trim() !== ''

    const filterOptions = useMemo<FilterOption<DiscoverSearchFilter>[]>(
        () => [
            {
                value: 'all',
                label: t('discover.search.filter_all'),
                testID: 'discover_search_filter_all',
            },
            {
                value: 'markets',
                label: t('discover.search.filter_markets'),
                testID: 'discover_search_filter_markets',
            },
            {
                value: 'dapps',
                label: t('discover.search.filter_dapps'),
                testID: 'discover_search_filter_dapps',
            },
        ],
        [t],
    )

    const matchedDapps = useMemo(
        () => filterDappsByQuery(directory.projects, debounced),
        [directory.projects, debounced],
    )
    // Every chip shares one asset query, so a chip change never refetches.
    const assetSearch = useAssetSearchAcrossScopesQuery(debounced, scopes, {
        enabled: debounced.trim().length > 0,
    })
    const assetResults = useMemo(
        () => (filter === 'dapps' ? [] : assetSearch.results),
        [filter, assetSearch.results],
    )

    const typedUrl = useMemo(
        () =>
            looksLikeUrl(query) ? toValidatedBrowserUrl(query.trim()) : null,
        [query],
    )

    // The typed-URL row already stands for a directory dApp at the same url.
    const dappResults = useMemo(() => {
        if (filter === 'markets') return []
        if (typedUrl === null || filter !== 'all') return matchedDapps
        const typedKey = normalizeDappUrl(typedUrl)
        return matchedDapps.filter(d => normalizeDappUrl(d.url) !== typedKey)
    }, [filter, matchedDapps, typedUrl])

    const verifiedUrls = directory.verifiedUrls
    const isVerified = useCallback(
        (url: string) => verifiedUrls.has(normalizeDappUrl(url) ?? ''),
        [verifiedUrls],
    )
    const isFavorite = useCallback(
        (url: string) => {
            const key = normalizeDappUrl(url)
            return key !== null && key in favorites
        },
        [favorites],
    )

    const openAssetDetails = useCallback(
        (
            assetId: string,
            chainId: ScopedAssetSearchResult['scope']['chainId'],
        ) => {
            navigation.navigate('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'AssetDetails',
                    params: { assetId, chainId },
                },
            })
        },
        [navigation],
    )

    const openTypedUrl = useCallback(() => {
        if (typedUrl === null) return
        const dapp = dappFromUrl(typedUrl)
        if (dapp === null) {
            logger.warn('Discover search refused an invalid typed URL', {
                url: typedUrl,
            })
            return
        }
        pushRecent({ kind: 'url', url: typedUrl })
        trackEvent(DiscoverEvent.SearchResultTap, dappEventPayload(dapp, null))
        // The in-app browser star toggles the typed-URL favorite.
        openDappPage(dapp, null)
    }, [typedUrl, pushRecent, openDappPage])

    const openWebSearch = useCallback(() => {
        const url = `${WEB_SEARCH_URL_PREFIX}${encodeURIComponent(query.trim())}`
        pushRecent({ kind: 'url', url })
        trackEvent(DiscoverEvent.SearchResultTap, { [Key.DappUrl]: url })
        openWebPage(url)
    }, [query, pushRecent, openWebPage])

    const openDapp = useCallback(
        (dapp: DiscoverDapp) => {
            pushRecent({ kind: 'dapp', dapp })
            trackEvent(
                DiscoverEvent.SearchResultTap,
                dappEventPayload(dapp, null),
            )
            openDappPage(dapp, null)
        },
        [pushRecent, openDappPage],
    )

    const openAsset = useCallback(
        ({ scope, asset }: ScopedAssetSearchResult) => {
            pushRecent({
                kind: 'asset',
                ref: { chainId: scope.chainId, assetId: asset.assetId },
                name: asset.name ?? '',
                unitName: asset.unitName ?? '',
                logo: asset.peraMetadata?.logo ?? null,
            })
            trackEvent(DiscoverEvent.SearchResultTap, {
                [Key.AssetId]: asset.assetId,
                [Key.ChainId]: scope.chainId,
            })
            openAssetDetails(asset.assetId, scope.chainId)
        },
        [pushRecent, openAssetDetails],
    )

    const openRecent = useCallback(
        (recent: RecentSearch) => {
            pushRecent(recent)
            switch (recent.kind) {
                case 'url': {
                    trackEvent(DiscoverEvent.SearchResultTap, {
                        [Key.DappUrl]: recent.url,
                    })
                    // A searched domain reopens as the typed-URL row opens it, so
                    // the in-browser star survives; a DuckDuckGo search stays plain.
                    const dapp = recent.url.startsWith(WEB_SEARCH_URL_PREFIX)
                        ? null
                        : dappFromUrl(recent.url)
                    if (dapp === null) openWebPage(recent.url)
                    else openDappPage(dapp, null)
                    return
                }
                case 'dapp': {
                    trackEvent(
                        DiscoverEvent.SearchResultTap,
                        dappEventPayload(recent.dapp, null),
                    )
                    openDappPage(recent.dapp, null)
                    return
                }
                case 'asset': {
                    trackEvent(DiscoverEvent.SearchResultTap, {
                        [Key.AssetId]: recent.ref.assetId,
                        [Key.ChainId]: recent.ref.chainId,
                    })
                    openAssetDetails(recent.ref.assetId, recent.ref.chainId)
                    return
                }
            }
        },
        [pushRecent, openWebPage, openDappPage, openAssetDetails],
    )

    const submit = useCallback(() => {
        if (typedUrl !== null) {
            openTypedUrl()
        } else if (isTyping) {
            openWebSearch()
        }
    }, [typedUrl, isTyping, openTypedUrl, openWebSearch])

    const toggleFavorite = useCallback(
        (dapp: DiscoverDapp) => {
            toggle(dapp, null)
        },
        [toggle],
    )

    const toggleTypedUrlFavorite = useCallback(() => {
        if (typedUrl === null) return
        const dapp = dappFromUrl(typedUrl)
        if (dapp !== null) toggle(dapp, null)
    }, [typedUrl, toggle])

    const cancel = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return {
        query,
        setQuery,
        filter,
        setFilter,
        filterOptions,
        isTyping,
        isDebouncing: query.trim() !== debounced.trim(),
        typedUrl,
        isWebSearchRowVisible: filter === 'all' && isTyping,
        dappResults,
        assetResults,
        showChains: discoverChainIds.length > 1,
        isLoadingDapps: directory.isLoading,
        isLoadingAssets: assetSearch.isLoading,
        isAssetSearchIncomplete: assetSearch.isIncomplete,
        isAssetSearchUnavailable: assetSearch.isUnavailable,
        recents,
        isFavorite,
        isVerified,
        submit,
        openTypedUrl,
        openWebSearch,
        openDapp,
        openAsset,
        openRecent,
        toggleFavorite,
        toggleTypedUrlFavorite,
        removeRecent,
        clearRecents,
        cancel,
    }
}
