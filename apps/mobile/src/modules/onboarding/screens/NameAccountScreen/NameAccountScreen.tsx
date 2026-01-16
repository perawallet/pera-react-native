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

import { useStyles } from './styles'
import {
    PWButton,
    PWIcon,
    PWInput,
    PWOverlay,
    PWText,
    PWView,
} from '@components/core'
import { useTheme } from '@rneui/themed'
import { ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useLanguage } from '@hooks/useLanguage'
import { useNameAccountScreen } from './useNameAccountScreen'

export const NameAccountScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const {
        walletDisplay,
        isCreating,
        handleNameChange,
        handleFinish,
        numWallets,
    } = useNameAccountScreen()

    return (
        <KeyboardAvoidingView
            style={styles.mainContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <PWView style={styles.headerContainer}>
                <PWText variant='h1'>
                    {t('onboarding.name_account.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.helperText}
                >
                    {t('onboarding.name_account.description')}
                </PWText>
            </PWView>
            <PWView style={styles.walletNameContainer}>
                <PWIcon
                    name='wallet'
                    variant='secondary'
                />
                <PWText
                    variant='h4'
                    style={styles.nameText}
                >
                    {t('onboarding.name_account.wallet_label', {
                        count: numWallets + 1,
                    })}
                </PWText>
            </PWView>
            <PWInput
                label={t('onboarding.name_account.input_label')}
                containerStyle={styles.input}
                value={walletDisplay}
                onChangeText={handleNameChange}
                autoFocus
            />
            <PWView style={styles.spacer} />
            <PWButton
                style={styles.finishButton}
                variant='primary'
                title={t('onboarding.name_account.finish_button')}
                onPress={handleFinish}
                isLoading={isCreating}
                isDisabled={isCreating}
            />
            <PWOverlay
                isVisible={isCreating}
                overlayStyle={styles.overlay}
                backdropStyle={styles.overlayBackdrop}
            >
                <ActivityIndicator
                    size='large'
                    color={theme.colors.linkPrimary}
                />
                <PWText>{t('onboarding.create_account.processing')}</PWText>
            </PWOverlay>
        </KeyboardAvoidingView>
    )
}
