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

import { useCallback, useEffect } from 'react'
import { trackEvent, StakingEvent } from '@perawallet/wallet-core-analytics'
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
import type { StakingProject } from '@modules/staking/models'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

type UseStakingScreenResult = {
    projects: StakingProject[]
    isLoading: boolean
    isError: boolean
    handleRetry: () => void
    handleProjectPress: (project: StakingProject) => void
    handleHelpOpen: () => void
}

export const useStakingScreen = (): UseStakingScreenResult => {
    const provider = usePeraProvider()
    const analyticsService = provider.analytics
    const { pushWebView } = useWebView()
    const {
        data: projects,
        isLoading,
        isError,
        refetch,
    } = useStakingProjectsQuery()
    const { isDisclaimerAccepted, acceptDisclaimer } = useStakingDisclaimer()
    const { request: requestBottomSheet } = useBottomSheet()

    useEffect(() => {
        trackEvent(StakingEvent.Open)
    }, [])

    const openProject = useCallback(
        (project: StakingProject) => {
            analyticsService.logEvent('staking_click_dapp', {
                name: project.title,
                url: project.link,
            })

            pushWebView({
                url: project.link,
                enablePeraConnect: true,
            })
        },
        [analyticsService, pushWebView],
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
        refetch()
    }, [refetch])

    return {
        projects,
        isLoading,
        isError,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
    }
}
