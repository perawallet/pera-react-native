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
    PWIcon,
    PWImage,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useImportInfoScreen } from './useImportInfoScreen'

import keyImage from '@assets/images/key.webp'

export const ImportInfoScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { handleBackPress, handleRecoverPress, handleInfoPress } =
        useImportInfoScreen()

    return (
        <PWView style={styles.root}>
            <PWToolbar
                testID='import-info-toolbar'
                left={
                    <PWTouchableOpacity
                        onPress={handleBackPress}
                        testID='back-button'
                    >
                        <PWIcon name='chevron-left' />
                    </PWTouchableOpacity>
                }
                right={
                    <PWTouchableOpacity
                        onPress={handleInfoPress}
                        testID='info-button'
                    >
                        <PWIcon name='info' />
                    </PWTouchableOpacity>
                }
            />

            <PWView style={styles.content}>
                <PWImage
                    source={keyImage}
                    style={styles.image}
                    resizeMode='contain'
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
                />
            </PWView>
        </PWView>
    )
}
