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

import { useCallback, useRef } from 'react'
import { useAnalyticsService } from '@perawallet/wallet-core-platform-extension'
import { useWebView } from '@modules/webview'
import { useModalState } from '@hooks/useModalState'
import {
    useStakingDisclaimer,
    useStakingProjectsQuery,
} from '@modules/staking/hooks'
import type { StakingProject } from '@modules/staking/models'

type UseStakingScreenResult = {
    projects: StakingProject[]
    isLoading: boolean
    isError: boolean
    isHelpVisible: boolean
    isDisclaimerVisible: boolean
    handleRetry: () => void
    handleProjectPress: (project: StakingProject) => void
    handleHelpOpen: () => void
    handleHelpClose: () => void
    handleDisclaimerAccept: () => void
    handleDisclaimerClose: () => void
}

export const useStakingScreen = (): UseStakingScreenResult => {
    const analyticsService = useAnalyticsService()
    const { pushWebView } = useWebView()
    const {
        data: projects,
        isLoading,
        isError,
        refetch,
    } = useStakingProjectsQuery()
    const { isDisclaimerAccepted, acceptDisclaimer } = useStakingDisclaimer()

    const helpModal = useModalState()
    const disclaimerModal = useModalState()
    const pendingProjectRef = useRef<StakingProject | null>(null)

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
        (project: StakingProject) => {
            if (isDisclaimerAccepted) {
                openProject(project)
                return
            }

            pendingProjectRef.current = project
            disclaimerModal.open()
        },
        [isDisclaimerAccepted, openProject, disclaimerModal],
    )

    const handleDisclaimerAccept = useCallback(() => {
        acceptDisclaimer()
        disclaimerModal.close()

        if (!pendingProjectRef.current) {
            return
        }

        const project = pendingProjectRef.current
        pendingProjectRef.current = null
        openProject(project)
    }, [acceptDisclaimer, openProject, disclaimerModal])

    const handleDisclaimerClose = useCallback(() => {
        pendingProjectRef.current = null
        disclaimerModal.close()
    }, [disclaimerModal])

    const handleRetry = useCallback(() => {
        refetch()
    }, [refetch])

    return {
        projects,
        isLoading,
        isError,
        isHelpVisible: helpModal.isOpen,
        isDisclaimerVisible: disclaimerModal.isOpen,
        handleRetry,
        handleProjectPress,
        handleHelpOpen: helpModal.open,
        handleHelpClose: helpModal.close,
        handleDisclaimerAccept,
        handleDisclaimerClose,
    }
}
