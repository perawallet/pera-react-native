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
import { type RouteProp, useRoute } from '@react-navigation/native'
import {
    useRampPairsQuery,
    useRampRegionQuery,
    useOnramp,
    type RampPair,
    type RampRegion,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET_NAME,
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
import { trackEvent, OnrampEvent } from '@analytics'
import { type OnrampScreenParams } from '@modules/onramp/routes/types'
import { useOnrampIntroduction } from './useOnrampIntroduction'

const DEFAULT_DESTINATION_TOKEN_ID = ALGO_ASSET_NAME

type UseOnrampScreenResult = {
    isReady: boolean
    pairsState: 'ready' | 'loading' | 'offline' | 'error'
    pairs: RampPair[]
    sourceToken: Nullable<RampToken>
    destinationToken: Nullable<RampToken>
    selectedPair: Nullable<RampPair>
    region: Nullable<RampRegion>
    accountAddress: Nullable<string>
    activeTab: OnrampTab
    handleTabChange: (tab: OnrampTab) => void
    handleRegionInfoPress: () => void
    handleRetryPairs: () => void
}

// Resolve the destination token id to seed when none is selected: a matching
// route param wins, else ALGO, else the first available destination token.
const resolveSeedDestinationId = (
    pairs: RampPair[],
    destinationTokenId: Optional<string>,
): Nullable<string> => {
    const destinationIds = pairs.map(pair => pair.destinationToken.id)
    if (destinationTokenId && destinationIds.includes(destinationTokenId)) {
        return destinationTokenId
    }
    if (destinationIds.includes(DEFAULT_DESTINATION_TOKEN_ID)) {
        return DEFAULT_DESTINATION_TOKEN_ID
    }
    return destinationIds[0] ?? null
}

export const useOnrampScreen = (): UseOnrampScreenResult => {
    // The native onramp screen renders on the existing `Fund` tab route, so
    // its params arrive under the `Fund` route name (not `Onramp`).
    const route =
        useRoute<RouteProp<{ Fund: Optional<OnrampScreenParams> }, 'Fund'>>()
    const params = route.params

    const { request: requestBottomSheet } = useBottomSheet()
    const pairsQuery = useRampPairsQuery()
    const { data: pairs = [], isLoading: pairsLoading } = pairsQuery
    const { hasInternet } = useNetworkStatus()
    const { data: region } = useRampRegionQuery()
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const {
        selectedSourceTokenId,
        selectedDestinationTokenId,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
    } = useOnramp()
    const { isIntroductionSeen, markIntroductionSeen } = useOnrampIntroduction()

    const [activeTab, setActiveTab] = useState<OnrampTab>('fund')

    const sourceTokenId = params?.sourceTokenId
    const destinationTokenId = params?.destinationTokenId

    // Seed destination (defaults to ALGO) and source (only from a route param —
    // otherwise the source stays unset so the pay selector shows "Choose an
    // asset" on every fresh entry).
    useEffect(() => {
        if (pairsLoading || pairs.length === 0) return

        if (selectedDestinationTokenId === null) {
            const seedDestinationId = resolveSeedDestinationId(
                pairs,
                destinationTokenId,
            )
            if (seedDestinationId !== null) {
                setSelectedDestinationTokenId(seedDestinationId)
            }
        }

        if (selectedSourceTokenId === null && sourceTokenId) {
            const hasSource = pairs.some(
                pair => pair.sourceToken.id === sourceTokenId,
            )
            if (hasSource) {
                setSelectedSourceTokenId(sourceTokenId)
            }
        }
        // selectedSource/Destination are intentionally omitted: re-seeding on
        // each selection change would fight user-driven switches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        pairs,
        pairsLoading,
        sourceTokenId,
        destinationTokenId,
        setSelectedSourceTokenId,
        setSelectedDestinationTokenId,
    ])

    // Show the one-time welcome sheet. Marking it seen the moment it opens makes
    // the persisted flag the single guard, so the effect can't re-open it (and
    // strict-mode's double-invoke is harmless). Dismissing without Continue
    // therefore won't reshow — acceptable for an intro.
    useEffect(() => {
        if (isIntroductionSeen) return
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
                trackEvent(OnrampEvent.WelcomeContinue)
            }
        })
    }, [isIntroductionSeen, markIntroductionSeen, requestBottomSheet])

    const handleTabChange = useCallback((tab: OnrampTab) => {
        setActiveTab(tab)
        if (tab === 'history') {
            trackEvent(OnrampEvent.HistoryTabSelect)
        }
    }, [])

    const handleRegionInfoPress = useCallback(() => {
        void requestBottomSheet<void>({
            contents: (
                <OnrampCountryInfoContent countryName={region?.countryName} />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                // The content has no scroll container of its own, so let the
                // sheet create one (auto + autoCreateContainer:false renders
                // with no height — that's why it appeared to do nothing).
            },
        })
    }, [requestBottomSheet, region?.countryName])

    const destinationToken = useMemo<Nullable<RampToken>>(
        () =>
            pairs.find(
                pair => pair.destinationToken.id === selectedDestinationTokenId,
            )?.destinationToken ?? null,
        [pairs, selectedDestinationTokenId],
    )

    const sourceToken = useMemo<Nullable<RampToken>>(
        () =>
            pairs.find(pair => pair.sourceToken.id === selectedSourceTokenId)
                ?.sourceToken ?? null,
        [pairs, selectedSourceTokenId],
    )

    const selectedPair = useMemo<Nullable<RampPair>>(
        () =>
            pairs.find(
                pair =>
                    pair.sourceToken.id === selectedSourceTokenId &&
                    pair.destinationToken.id === selectedDestinationTokenId,
            ) ?? null,
        [pairs, selectedSourceTokenId, selectedDestinationTokenId],
    )

    const isReady = !pairsLoading && destinationToken !== null

    // PERA-4581 paused-state contract (docs/OFFLINE_PAUSED_STATE.md): a paused
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
        pairs,
        sourceToken,
        destinationToken,
        selectedPair,
        region: region ?? null,
        accountAddress: selectedAccountAddress ?? null,
        activeTab,
        handleTabChange,
        handleRegionInfoPress,
        handleRetryPairs,
    }
}
