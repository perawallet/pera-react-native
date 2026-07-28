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

import { useCallback, useEffect } from 'react'
import { trackEvent, StakingEvent, AnalyticsMetadataKey } from '@analytics'
import { useWebView } from '@modules/webview'
import {
    useStakingDisclaimer,
    useStakingProjectsQuery,
} from '@modules/staking/hooks'
import {
    StakingDisclaimerContent,
    StakingHelpContent,
} from '@modules/staking/components'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus, useNetworkStatusStore } from '@modules/network'
import type { StakingProject } from '@modules/staking/models'

type UseStakingScreenResult = {
    projects: StakingProject[]
    isLoading: boolean
    isError: boolean
    isOffline: boolean
    handleRetry: () => void
    handleProjectPress: (project: StakingProject) => Promise<void>
    handleHelpOpen: () => void
}

export const useStakingScreen = (): UseStakingScreenResult => {
    const { pushWebView } = useWebView()
    const {
        data: projects,
        isLoading,
        isError,
        isPaused,
        refetch,
    } = useStakingProjectsQuery()
    const { hasInternet } = useNetworkStatus()
    const { isDisclaimerAccepted, acceptDisclaimer } = useStakingDisclaimer()
    const { request: requestBottomSheet } = useBottomSheet()

    // Offline wins over a stale error: a paused, uncached fetch means there is
    // nothing to show yet, and an error surfacing while genuinely offline is
    // the same "nothing to show" situation — not a dead Retry. Mirrors the
    // PERA-4581 charts / TransactionDetails contract.
    const isOffline = isPaused || (isError && !hasInternet)

    useEffect(() => {
        trackEvent(StakingEvent.Open)
    }, [])

    const openProject = useCallback(
        (project: StakingProject) => {
            trackEvent(StakingEvent.SelectProject, {
                [AnalyticsMetadataKey.Name]: project.title,
                [AnalyticsMetadataKey.Url]: project.link,
            })

            pushWebView({
                url: project.link,
                enablePeraConnect: true,
            })
        },
        [pushWebView],
    )

    const handleProjectPress = useCallback(
        async (project: StakingProject) => {
            if (isDisclaimerAccepted) {
                openProject(project)
                return
            }

            const accepted = await requestBottomSheet<boolean>({
                contents: <StakingDisclaimerContent />,
                options: {
                    size: 'modal',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            if (!accepted) return

            acceptDisclaimer()
            openProject(project)
        },
        [
            isDisclaimerAccepted,
            openProject,
            requestBottomSheet,
            acceptDisclaimer,
        ],
    )

    const handleHelpOpen = useCallback(() => {
        void requestBottomSheet({
            contents: <StakingHelpContent />,
            // Needs a bounded size (not 'auto'): PWSheetLayout's scroll view
            // has no height to scroll within when the sheet hugs its content.
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const handleRetry = useCallback(() => {
        // Offline: skip the doomed request — the offline copy already
        // promises a refresh on reconnect (mirrors TransactionDetails retry).
        if (!useNetworkStatusStore.getState().hasInternet) {
            return
        }
        refetch()
    }, [refetch])

    return {
        projects,
        isLoading,
        isError,
        isOffline,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
    }
}
