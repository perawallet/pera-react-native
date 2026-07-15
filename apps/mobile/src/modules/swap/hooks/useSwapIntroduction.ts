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
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

type UseSwapIntroductionResult = {
    isIntroductionSeen: boolean
    markIntroductionSeen: () => void
}

export const useSwapIntroduction = (): UseSwapIntroductionResult => {
    const { getPreference, setPreference } = usePreferences()

    const isIntroductionSeen = !!getPreference(
        UserPreferences.swapIntroductionSeen,
    )

    const markIntroductionSeen = useCallback(() => {
        setPreference(UserPreferences.swapIntroductionSeen, true)
    }, [setPreference])

    return {
        isIntroductionSeen,
        markIntroductionSeen,
    }
}
