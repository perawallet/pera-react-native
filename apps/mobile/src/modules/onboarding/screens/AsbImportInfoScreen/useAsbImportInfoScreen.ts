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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'

type UseAsbImportInfoScreenResult = {
    handleContinue: () => void
}

export const useAsbImportInfoScreen = (): UseAsbImportInfoScreenResult => {
    const navigation = useAppNavigation()
    const reset = useAsbImportFlowStore(state => state.reset)

    // Reset on entry: backing out of the wizard and re-entering must not
    // carry over a previous attempt's envelope / payload / selection state.
    useEffect(() => {
        reset()
    }, [reset])

    const handleContinue = useCallback(() => {
        navigation.push('AsbImportBackup')
    }, [navigation])

    return { handleContinue }
}
