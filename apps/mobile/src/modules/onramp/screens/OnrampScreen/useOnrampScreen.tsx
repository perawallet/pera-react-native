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
    type RouteProp,
    useIsFocused,
    useRoute,
} from '@react-navigation/native'
import {
    buildRampPair,
    useRampDestinationsQuery,
    useRampRegionQuery,
    useRampSourcesQuery,
    useOnramp,
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

// Resolve the destination token id to seed when none is selected: the route's
// asset wins, else the chain's native coin, else the first available
// destination token.
const resolveSeedDestinationId = (
    destinations: RampToken[],
    destinationAssetId: Optional<string>,
    scope: ChainScope,
): Nullable<string> => {
    const assetOf = (token: RampToken) => rampTokenAsset(token, scope)
    const requested = destinationAssetId
        ? destinations.find(
              token => assetOf(token)?.assetId === destinationAssetId,
          )
        : undefined
    if (requested) return requested.id
    const native = destinations.find(token => assetOf(token)?.isNative)
    if (native) return native.id
    return destinations[0]?.id ?? null
}

export const useOnrampScreen = (): UseOnrampScreenResult => {
    // The native onramp screen renders on the existing `Fund` tab route, so
    // its params arrive under the `Fund` route name (not `Onramp`).
    const route =
        useRoute<RouteProp<{ Fund: Optional<OnrampScreenParams> }, 'Fund'>>()
    const params = route.params

    const isFocused = useIsFocused()
    const { request: requestBottomSheet } = useBottomSheet()
    const { scope, address: selectedAccountAddress } = useOnrampAccount()
    const trackOnrampEvent = useTrackOnrampEvent()
    const pairsQuery = useRampDestinationsQuery({ scope })
    const { data: destinations, isLoading: pairsLoading } = pairsQuery
    const { hasInternet } = useNetworkStatus()
    const { data: region } = useRampRegionQuery({ scope })
    const {
        selectedSourceTokenId,
        selectedDestinationTokenId,
        setSelectedDestinationTokenId,
    } = useOnramp()
    const { isIntroductionSeen, markIntroductionSeen } = useOnrampIntroduction()

    const [activeTab, setActiveTab] = useState<OnrampTab>('fund')

    const destinationAssetId = params?.destinationAssetId

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
                destinationAssetId,
                scope,
            )
            if (seedDestinationId !== null) {
                setSelectedDestinationTokenId(seedDestinationId)
            }
        }
        // selectedDestination is intentionally omitted: re-seeding on each
        // selection change would fight user-driven switches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        destinations,
        pairsLoading,
        destinationAssetId,
        scope,
        setSelectedDestinationTokenId,
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
        return 'loading'
    }, [isReady, pairsQuery, hasInternet])

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
