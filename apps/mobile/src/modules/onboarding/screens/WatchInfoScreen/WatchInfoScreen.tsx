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
import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useWatchInfoScreen } from './useWatchInfoScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

export const WatchInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleCreateWatchAccount, handleInfoPress } = useWatchInfoScreen()

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
                <PWView style={styles.footerInner}>
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
            }
        >
            <ScreenHeader
                icon='eye'
                title={t('onboarding.watch_account.info_title')}
                description={t('onboarding.watch_account.info_description')}
            />
        </PWScreen>
    )
}
