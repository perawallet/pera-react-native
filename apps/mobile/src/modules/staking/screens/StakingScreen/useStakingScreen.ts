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

import { useCallback, useRef, useState } from 'react'
import { useAnalyticsService } from '@perawallet/wallet-core-platform-integration'
import { useAppNavigation } from '@hooks/useAppNavigation'
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
    handleBack: () => void
    handleRetry: () => void
    handleProjectPress: (project: StakingProject) => void
    handleHelpOpen: () => void
    handleHelpClose: () => void
    handleDisclaimerAccept: () => void
    handleDisclaimerClose: () => void
}

export const useStakingScreen = (): UseStakingScreenResult => {
    const navigation = useAppNavigation()
    const analyticsService = useAnalyticsService()
    const { projects, isLoading, isError, refetch } = useStakingProjectsQuery()
    const { isDisclaimerAccepted, acceptDisclaimer } = useStakingDisclaimer()

    const [isHelpVisible, setIsHelpVisible] = useState(false)
    const [isDisclaimerVisible, setIsDisclaimerVisible] = useState(false)
    const pendingProjectRef = useRef<StakingProject | null>(null)

    const handleBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    const openProject = useCallback(
        (project: StakingProject) => {
            analyticsService.logEvent('staking_click_dapp', {
                name: project.title,
                url: project.link,
            })

            navigation.push('StakingDApp', {
                title: project.title,
                url: project.link,
            })
        },
        [analyticsService, navigation],
    )

    const handleProjectPress = useCallback(
        (project: StakingProject) => {
            if (isDisclaimerAccepted) {
                openProject(project)
                return
            }

            pendingProjectRef.current = project
            setIsDisclaimerVisible(true)
        },
        [isDisclaimerAccepted, openProject],
    )

    const handleDisclaimerAccept = useCallback(() => {
        acceptDisclaimer()
        setIsDisclaimerVisible(false)

        if (!pendingProjectRef.current) {
            return
        }

        const project = pendingProjectRef.current
        pendingProjectRef.current = null
        openProject(project)
    }, [acceptDisclaimer, openProject])

    const handleDisclaimerClose = useCallback(() => {
        pendingProjectRef.current = null
        setIsDisclaimerVisible(false)
    }, [])

    const handleHelpClose = useCallback(() => {
        setIsHelpVisible(false)
    }, [])

    const handleHelpOpen = useCallback(() => {
        setIsHelpVisible(true)
    }, [])

    const handleRetry = useCallback(() => {
        refetch()
    }, [refetch])

    return {
        projects,
        isLoading,
        isError,
        isHelpVisible,
        isDisclaimerVisible,
        handleBack,
        handleRetry,
        handleProjectPress,
        handleHelpOpen,
        handleHelpClose,
        handleDisclaimerAccept,
        handleDisclaimerClose,
    }
}
