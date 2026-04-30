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
import { useWatchInfoScreen } from './useWatchInfoScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const WatchInfoScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { handleCreateWatchAccount, handleInfoPress, EyeImageComponent } =
        useWatchInfoScreen()

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
                <EyeImageComponent
                    style={styles.image}
                    width={160}
                    height={160}
                />
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('onboarding.watch_account.info_title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('onboarding.watch_account.info_description')}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                <PWView style={styles.warningRow}>
                    <PWIcon
                        name='warning'
                        variant='error'
                    />
                    <PWText
                        variant='body'
                        style={styles.warning}
                    >
                        {t('onboarding.watch_account.info_warning')}
                    </PWText>
                </PWView>
                <PWButton
                    variant='primary'
                    title={t('onboarding.watch_account.info_button')}
                    onPress={handleCreateWatchAccount}
                />
            </PWView>
        </PWView>
    )
}
