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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    type NavigationProp,
    type RouteProp,
    useIsFocused,
    useNavigation,
    useRoute,
} from '@react-navigation/native'
import {
    buildRampPair,
    useRampDestinationsQuery,
    useRampRegionQuery,
    useRampSourcesQuery,
    useOnramp,
    useOnrampDestinationChains,
    rampTokenAsset,
    type RampPair,
    type RampRegion,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isIntegrityRequiredError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import {
    OnrampCountryInfoContent,
    OnrampIntroductionContent,
    type OnrampTab,
} from '@modules/onramp/components'
import { OnrampEvent } from '@analytics'
import type { OnrampScreenParams } from '@modules/onramp/routes/types'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'
import { useTrackOnrampEvent } from '@modules/onramp/hooks/useTrackOnrampEvent'
import { useOnrampIntroduction } from './useOnrampIntroduction'

type UseOnrampScreenResult = {
    isReady: boolean
    pairsState: 'ready' | 'loading' | 'offline' | 'error'
    isPairsIntegrityBlocked: boolean
    sourceToken: Nullable<RampToken>
    destinationToken: Nullable<RampToken>
    selectedPair: Nullable<RampPair>
    region: Nullable<RampRegion>
    accountAddress: Nullable<string>
    /** The chain and network Fund buys onto; null when the selected account can't be funded. */
    scope: Nullable<ChainScope>
    canFundSelectedAccount: boolean
    activeTab: OnrampTab
    handleTabChange: (tab: OnrampTab) => void
    handleRegionInfoPress: () => void
    handleRetryPairs: () => void
}

// The destination to seed when none is selected: the chain's native coin, else
// the first available destination token.
const resolveSeedDestinationId = (
    destinations: RampToken[],
    scope: ChainScope,
): Nullable<string> => {
    const native = destinations.find(
        token => rampTokenAsset(token, scope)?.isNative,
    )
    if (native) return native.id
    return destinations[0]?.id ?? null
}

export const useOnrampScreen = (): UseOnrampScreenResult => {
    // The native onramp screen renders on the existing `Fund` tab route, so
    // its params arrive under the `Fund` route name (not `Onramp`).
    const route =
        useRoute<RouteProp<{ Fund: Optional<OnrampScreenParams> }, 'Fund'>>()
    const navigation =
        useNavigation<NavigationProp<{ Fund: Optional<OnrampScreenParams> }>>()
    const params = route.params

    const isFocused = useIsFocused()
    const { request: requestBottomSheet } = useBottomSheet()
    const {
        account,
        scope,
        address: selectedAccountAddress,
    } = useOnrampAccount()
    const fundableChains = useOnrampDestinationChains(account)
    const trackOnrampEvent = useTrackOnrampEvent()
    const pairsQuery = useRampDestinationsQuery({ scope })
    const { data: destinations, isLoading: pairsLoading } = pairsQuery
    const { hasInternet } = useNetworkStatus()
    const { data: region } = useRampRegionQuery({ scope })
    const {
        selectedSourceTokenId,
        selectedDestinationTokenId,
        setSelectedDestinationTokenId,
        selectedChainId,
        setSelectedChainId,
    } = useOnramp()
    const { isIntroductionSeen, markIntroductionSeen } = useOnrampIntroduction()

    const [activeTab, setActiveTab] = useState<OnrampTab>('fund')

    const routeChainId = params?.chainId
    const routeDestinationAssetId = params?.destinationAssetId

    // The chain chips live in the receive sheet, which only opens from the
    // form, so a chosen chain with nothing to list would strand Fund on its
    // retry state. A settled empty answer (not a failure) drops the choice.
    const isListSettledEmpty =
        !pairsLoading &&
        pairsQuery.fetchStatus === 'idle' &&
        !pairsQuery.isError &&
        destinations.length === 0

    // A route naming a chain the selected account can't be funded on is spent
    // unapplied: it would otherwise linger and overwrite a later chip pick.
    const isRouteReachable =
        routeChainId !== undefined && fundableChains.includes(routeChainId)

    const spendRoute = useCallback(() => {
        navigation.setParams({
            chainId: undefined,
            destinationAssetId: undefined,
        })
    }, [navigation])

    // A chain change reseeds the destination.
    useEffect(() => {
        if (routeChainId && isRouteReachable) setSelectedChainId(routeChainId)
    }, [routeChainId, isRouteReachable, setSelectedChainId])

    useEffect(() => {
        if (routeChainId && !isRouteReachable) spendRoute()
    }, [routeChainId, isRouteReachable, spendRoute])

    // Seed the destination (defaults to the native coin). The source stays
    // unset so the pay selector shows "Choose an asset" on every fresh entry.
    // A persisted destination the router no longer lists is reseeded, or the
    // form would wait on it.
    useEffect(() => {
        if (scope === null || pairsLoading || destinations.length === 0) return

        const isDestinationListed = destinations.some(
            token => token.id === selectedDestinationTokenId,
        )
        if (selectedDestinationTokenId === null || !isDestinationListed) {
            const seedDestinationId = resolveSeedDestinationId(
                destinations,
                scope,
            )
            if (seedDestinationId !== null) {
                setSelectedDestinationTokenId(seedDestinationId)
            }
        }
        // selectedDestination is intentionally omitted: re-seeding on each
        // selection change would fight user-driven switches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [destinations, pairsLoading, scope, setSelectedDestinationTokenId])

    // After the seed effect, so the route's token wins over a seeded or
    // remembered one. The route is spent once applied: left in place, a repeat
    // visit with the same params would not re-apply and a later pick could be
    // overwritten. Waits until the scope is the route's chain, since the
    // destinations in hand belong to the previous one until then. A chain that
    // lists nothing has no asset to apply, so the route is spent there too.
    useEffect(() => {
        if (!routeChainId || scope?.chainId !== routeChainId) return
        if (routeDestinationAssetId && !isListSettledEmpty) {
            if (pairsLoading || destinations.length === 0) return
            const requested = destinations.find(
                token =>
                    rampTokenAsset(token, scope)?.assetId ===
                    routeDestinationAssetId,
            )
            if (requested) setSelectedDestinationTokenId(requested.id)
        }
        spendRoute()
    }, [
        spendRoute,
        routeChainId,
        routeDestinationAssetId,
        scope,
        isListSettledEmpty,
        pairsLoading,
        destinations,
        setSelectedDestinationTokenId,
    ])

    // Only a choice whose own list came back empty is dropped: while the scope
    // is on another chain (the account isn't funded on the choice) the empty
    // list is that chain's, and a pending route is about to replace the choice.
    useEffect(() => {
        if (routeChainId) return
        if (
            selectedChainId !== null &&
            scope?.chainId === selectedChainId &&
            isListSettledEmpty
        ) {
            setSelectedChainId(null)
        }
    }, [
        routeChainId,
        isListSettledEmpty,
        scope,
        selectedChainId,
        setSelectedChainId,
    ])

    // Show the one-time welcome sheet. Marking it seen the moment it opens makes
    // the persisted flag the single guard, so the effect can't re-open it (and
    // strict-mode's double-invoke is harmless). Dismissing without Continue
    // therefore won't reshow — acceptable for an intro.
    // Waits for a scope so the analytics event can name the chain, and for
    // focus because tab screens stay mounted behind whichever tab is active.
    useEffect(() => {
        if (isIntroductionSeen || scope === null || !isFocused) return
        markIntroductionSeen()
        void requestBottomSheet<'start'>({
            contents: <OnrampIntroductionContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        }).then(result => {
            if (result === 'start') {
                trackOnrampEvent(OnrampEvent.WelcomeContinue)
            }
        })
    }, [
        isFocused,
        isIntroductionSeen,
        markIntroductionSeen,
        requestBottomSheet,
        scope,
        trackOnrampEvent,
    ])

    const handleTabChange = useCallback(
        (tab: OnrampTab) => {
            setActiveTab(tab)
            if (tab === 'history') {
                trackOnrampEvent(OnrampEvent.HistoryTabSelect)
            }
        },
        [trackOnrampEvent],
    )

    const handleRegionInfoPress = useCallback(() => {
        void requestBottomSheet<void>({
            contents: (
                <OnrampCountryInfoContent
                    countryCode={region?.countryCode}
                    countryName={region?.countryName}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                // The content has no scroll container of its own, so let the
                // sheet create one (auto + autoCreateContainer:false renders
                // with no height — that's why it appeared to do nothing).
            },
        })
    }, [requestBottomSheet, region?.countryCode, region?.countryName])

    const destinationToken = useMemo<Nullable<RampToken>>(
        () =>
            destinations.find(
                token => token.id === selectedDestinationTokenId,
            ) ?? null,
        [destinations, selectedDestinationTokenId],
    )

    const { data: sources } = useRampSourcesQuery({
        scope,
        destinationId: destinationToken?.id ?? null,
    })

    const sourceToken = useMemo<Nullable<RampToken>>(
        () => sources.find(token => token.id === selectedSourceTokenId) ?? null,
        [sources, selectedSourceTokenId],
    )

    const selectedPair = useMemo<Nullable<RampPair>>(
        () =>
            sourceToken !== null && destinationToken !== null
                ? buildRampPair(sourceToken, destinationToken)
                : null,
        [sourceToken, destinationToken],
    )

    const isReady = !pairsLoading && destinationToken !== null

    // Paused-state contract (docs/OFFLINE_PAUSED_STATE.md): a paused
    // query reports isPending forever, so offline must be resolved before the
    // spinner, and cached/stale data (isReady) always wins over either.
    const pairsState = useMemo(():
        | 'ready'
        | 'loading'
        | 'offline'
        | 'error' => {
        if (isReady) return 'ready'
        const isPaused = pairsQuery.fetchStatus === 'paused'
        if (isPaused || (pairsQuery.isError && !hasInternet)) return 'offline'
        if (pairsQuery.isError) return 'error'
        // The list is filtered by region and route, so a settled empty answer is
        // normal; it reuses the retry state rather than spinning forever.
        if (
            !pairsLoading &&
            pairsQuery.fetchStatus === 'idle' &&
            destinations.length === 0
        ) {
            return 'error'
        }
        return 'loading'
    }, [isReady, pairsQuery, pairsLoading, destinations, hasInternet])

    const handleRetryPairs = useCallback(() => {
        void pairsQuery.refetch()
    }, [pairsQuery])

    return {
        isReady,
        pairsState,
        isPairsIntegrityBlocked:
            pairsState === 'error' &&
            isIntegrityRequiredError(pairsQuery.error),
        sourceToken,
        destinationToken,
        selectedPair,
        region: region ?? null,
        accountAddress: selectedAccountAddress,
        scope,
        canFundSelectedAccount: scope !== null,
        activeTab,
        handleTabChange,
        handleRegionInfoPress,
        handleRetryPairs,
    }
}
