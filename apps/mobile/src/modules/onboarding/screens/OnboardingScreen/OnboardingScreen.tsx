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

import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'
import { PWOverlay, PWText, PWView } from '@components/core'
import { PanelButton } from '@components/PanelButton'

import WelcomeImage from '@assets/images/welcome-background.svg'
import { ActivityIndicator } from 'react-native'
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import { useState } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

export const OnboardingScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const styles = useStyles()
    const createAccount = useCreateAccount()
    const { theme } = useTheme()
    const [processing, setProcessing] = useState(false)
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { setPreference } = usePreferences()

    const doCreate = async () => {
        try {
            setPreference(UserPreferences.isCreatingAccount, true)
            const account = await createAccount({ account: 0, keyIndex: 0 })
            navigation.push('Onboarding', {
                screen: 'NameAccount',
                params: { account: account },
            })
        } catch (error) {
            showToast({
                title: t('onboarding.create_account.error_title'),
                body: t('onboarding.create_account.error_message', {
                    error: `${error}`,
                }),
                type: 'error',
            })
        } finally {
            setProcessing(false)
        }
    }

    const createAccountHandler = async () => {
        setProcessing(true)
        requestAnimationFrame(() => {
            doCreate()
        })
    }

    const importAccount = () => {
        navigation.push('ImportAccount')
    }

    return (
        <>
            <PWView>
                <PWView style={styles.headerContainer}>
                    <PWText
                        style={styles.headerTitle}
                        variant='h1'
                    >
                        {t('onboarding.main_screen.welcome')}
                    </PWText>
                    <WelcomeImage style={styles.headerImage} />
                </PWView>
                <PWView style={styles.mainContainer}>
                    <PWText
                        style={styles.buttonTitle}
                        variant='h4'
                    >
                        {t('onboarding.main_screen.new_to_algo')}
                    </PWText>
                    <PanelButton
                        title={t('onboarding.main_screen.create_wallet')}
                        titleWeight='h4'
                        onPress={createAccountHandler}
                        leftIcon={'wallet-with-algo'}
                        rightIcon={'chevron-right'}
                    />

                    <PWText
                        style={styles.buttonTitle}
                        variant='h4'
                    >
                        {t('onboarding.main_screen.already_have_account')}
                    </PWText>
                    <PanelButton
                        title={t('onboarding.main_screen.import_account')}
                        titleWeight='h4'
                        onPress={importAccount}
                        leftIcon={'key'}
                        rightIcon={'chevron-right'}
                    />
                </PWView>
            </PWView>
            <PWOverlay
                isVisible={processing}
                overlayStyle={styles.overlay}
                backdropStyle={styles.overlayBackdrop}
            >
                <ActivityIndicator
                    size='large'
                    color={theme.colors.linkPrimary}
                />
                <PWText>{t('onboarding.create_account.processing')}</PWText>
            </PWOverlay>
        </>
    )
}
