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

import React from 'react'
import { PWButton, PWScreen } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { useAsbImportInfoScreen } from './useAsbImportInfoScreen'

export const AsbImportInfoScreen = () => {
    const { t } = useLanguage()
    const { handleContinue } = useAsbImportInfoScreen()

    return (
        <PWScreen
            footer={
                <PWButton
                    variant='primary'
                    title={t('onboarding.asb_import.info.continue')}
                    onPress={handleContinue}
                    testID='asb_import_info_continue_button'
                />
            }
        >
            <ScreenHeader
                icon='shield-check'
                title={t('onboarding.asb_import.info.title')}
                description={t('onboarding.asb_import.info.body')}
            />
        </PWScreen>
    )
}
