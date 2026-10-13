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

import { useCallback } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useFinishCameraTab } from '@hooks/useFinishCameraTab'
import type { PostCreateReturnTarget } from '@modules/onboarding/routes/types'
import { useIsOnboarding } from './useOnboardingStore'

type UseExitAccountFlowResult = {
    exitAccountFlow: (returnTo?: PostCreateReturnTarget) => void
    /** Same exit, for an import that saved nothing. */
    exitFailedAccountFlow: () => void
}

/**
 * Hook that handles exiting an account creation/import flow.
 *
 * In the initial onboarding flow, `setIsOnboarding(false)` triggers the root
 * navigator to switch from the Onboarding stack to TabBar.
 *
 * In the AddAccount flow (mid-app), `isOnboarding` is already false so we
 * navigate explicitly to TabBar.
 *
 * A `returnTo` target (threaded from the route) overrides both, so a caller
 * flow (e.g. Pera Card's Connect Funds) can resume itself instead of Home.
 */
export const useExitAccountFlow = (): UseExitAccountFlowResult => {
    const navigation = useAppNavigation()
    const { isOnboarding, setIsOnboarding } = useIsOnboarding()
    const { finishCameraTab } = useFinishCameraTab()

    const navigateOut = useCallback(
        (returnTo?: PostCreateReturnTarget) => {
            if (returnTo) {
                navigation.navigate(
                    returnTo.name as never,
                    returnTo.params as never,
                )
            } else if (isOnboarding) {
                setIsOnboarding(false)
            } else {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'TabBar', params: { screen: 'Home' } }],
                })
            }
        },
        [isOnboarding, setIsOnboarding, navigation],
    )

    const exitAccountFlow = useCallback(
        (returnTo?: PostCreateReturnTarget) => {
            navigateOut(returnTo)
            finishCameraTab()
        },
        [navigateOut, finishCameraTab],
    )

    const exitFailedAccountFlow = useCallback(() => {
        navigateOut()
        finishCameraTab('failed')
    }, [navigateOut, finishCameraTab])

    return { exitAccountFlow, exitFailedAccountFlow }
}
