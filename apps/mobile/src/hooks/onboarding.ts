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

import { usePreferences } from '@perawallet/wallet-core-settings'
import { useHasNoAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { UserPreferences } from '@constants/user-preferences'
import { useMemo } from 'react'

export const useShowOnboarding = () => {
    const { getPreference } = usePreferences()
    const noAccounts = useHasNoAccounts()

    const showOnboarding = useMemo(() => {
        const isCreatingAccount =
            getPreference(UserPreferences.isCreatingAccount) === true
        logger.debug('useShowOnboarding', {
            onboardingData: {
                isCreatingAccount,
                noAccounts,
                showOnboarding: isCreatingAccount || noAccounts,
            },
        })
        return isCreatingAccount || noAccounts
    }, [getPreference, noAccounts])

    return showOnboarding
}
