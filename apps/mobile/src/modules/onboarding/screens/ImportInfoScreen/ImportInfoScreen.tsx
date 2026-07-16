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
import { PWButton, PWIcon, PWScreen } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { useImportInfoScreen } from './useImportInfoScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

export const ImportInfoScreen = () => {
    const { t } = useLanguage()
    const { handleRecoverPress, handleInfoPress } = useImportInfoScreen()

    useNavigationHeader({
        right: (
            <PWIcon
                name='info'
                onPress={handleInfoPress}
                testID='info-button'
            />
        ),
    })

    return (
        <PWScreen
            footer={
                <PWButton
                    variant='primary'
                    title={t('onboarding.import_info.button')}
                    onPress={handleRecoverPress}
                    testID='import_info_recover_button'
                />
            }
        >
            <ScreenHeader
                icon='key'
                title={t('onboarding.import_info.title')}
                description={t('onboarding.import_info.body')}
            />
        </PWScreen>
    )
}
