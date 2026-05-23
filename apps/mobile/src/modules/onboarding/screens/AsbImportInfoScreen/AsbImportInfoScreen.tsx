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

import React from 'react'
import {
    PWButton,
    PWRoundIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAsbImportInfoScreen } from './useAsbImportInfoScreen'

export const AsbImportInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleContinue } = useAsbImportInfoScreen()

    return (
        <PWScreen
            scroll={false}
            footer={
                <PWButton
                    variant='primary'
                    title={t('onboarding.asb_import.info.continue')}
                    onPress={handleContinue}
                    testID='asb_import_info_continue_button'
                />
            }
        >
            <PWView style={styles.content}>
                <PWRoundIcon
                    icon='shield-check'
                    size='xxl'
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.asb_import.info.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('onboarding.asb_import.info.body')}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
