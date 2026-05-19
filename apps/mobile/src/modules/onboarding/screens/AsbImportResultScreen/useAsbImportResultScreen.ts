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

import { useCallback, useMemo } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import type { PWResultViewVariant } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
import type { OnboardingStackParamList } from '../../routes/types'

type UseAsbImportResultScreenResult = {
    importedCount: number
    skippedDuplicateCount: number
    failedCount: number
    variant: PWResultViewVariant
    title: string
    body: string | undefined
    handleDone: () => void
}

export const useAsbImportResultScreen = (): UseAsbImportResultScreenResult => {
    const route =
        useRoute<RouteProp<OnboardingStackParamList, 'AsbImportResult'>>()
    const { t } = useLanguage()
    const reset = useAsbImportFlowStore(state => state.reset)
    const { exitAccountFlow } = useExitAccountFlow()

    const importedCount = route.params?.importedCount ?? 0
    const skippedDuplicateCount = route.params?.skippedDuplicateCount ?? 0
    const failedCount = route.params?.failedCount ?? 0

    const { variant, title, body } = useMemo<{
        variant: PWResultViewVariant
        title: string
        body: string | undefined
    }>(() => {
        if (importedCount > 0 && failedCount === 0) {
            return {
                variant: 'success',
                title: t('onboarding.asb_import.result.success_title'),
                body: t('onboarding.asb_import.result.success_body', {
                    count: importedCount,
                }),
            }
        }
        if (importedCount > 0 && failedCount > 0) {
            return {
                variant: 'warning',
                title: t('onboarding.asb_import.result.partial_title'),
                body: t('onboarding.asb_import.result.partial_body'),
            }
        }
        // No accounts imported. Could be all-already-imported or all-failed.
        if (failedCount === 0 && skippedDuplicateCount > 0) {
            return {
                variant: 'warning',
                title: t('onboarding.asb_import.result.nothing_new_title'),
                body: t('onboarding.asb_import.result.nothing_new_body'),
            }
        }
        return {
            variant: 'error',
            title: t('onboarding.asb_import.result.failed_title'),
            body: t('onboarding.asb_import.result.failed_body'),
        }
    }, [importedCount, skippedDuplicateCount, failedCount, t])

    const handleDone = useCallback(() => {
        reset()
        exitAccountFlow()
    }, [reset, exitAccountFlow])

    return {
        importedCount,
        skippedDuplicateCount,
        failedCount,
        variant,
        title,
        body,
        handleDone,
    }
}
