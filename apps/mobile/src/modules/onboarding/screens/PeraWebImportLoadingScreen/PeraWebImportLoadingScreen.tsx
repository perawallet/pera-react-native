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
import { PWRoundIcon, PWScreen, PWText, PWView } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { usePeraWebImportLoadingScreen } from './usePeraWebImportLoadingScreen'

export const PeraWebImportLoadingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    // Mounting kicks off the fetch → decrypt → import pipeline. The hook
    // navigates away to the result screen when it's done; this screen just
    // renders the loading state.
    usePeraWebImportLoadingScreen()

    return (
        <PWScreen
            scroll='never'
            body={
                <PWView style={styles.container}>
                    <PWRoundIcon
                        icon='globe'
                        size='xxl'
                    />
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {t('onboarding.pera_web_import.loading.title')}
                    </PWText>
                    <PWView testID='pera_web_import_loading_indicator'>
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    </PWView>
                </PWView>
            }
        />
    )
}
