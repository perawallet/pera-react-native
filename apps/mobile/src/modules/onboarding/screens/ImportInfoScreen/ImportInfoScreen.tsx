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
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useImportInfoScreen } from './useImportInfoScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const ImportInfoScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { handleRecoverPress, handleInfoPress, KeyImageComponent } =
        useImportInfoScreen()

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
        <PWView style={styles.root}>
            <PWView style={styles.content}>
                <KeyImageComponent
                    style={styles.image}
                    width={160}
                    height={160}
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.import_info.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('onboarding.import_info.body')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    variant='primary'
                    title={t('onboarding.import_info.button')}
                    onPress={handleRecoverPress}
                    testID='import_info_recover_button'
                />
            </PWView>
        </PWView>
    )
}
