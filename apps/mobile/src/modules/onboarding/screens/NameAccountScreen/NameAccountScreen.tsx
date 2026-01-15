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

import { useNavigation } from '@react-navigation/native'
import {
    NativeStackNavigationProp,
    NativeStackScreenProps,
} from '@react-navigation/native-stack'
import { useStyles } from './styles'
import { PWButton, PWIcon, PWInput, PWText, PWView } from '@components/core'

import {
    useAllAccounts,
    getAccountDisplayName,
    WalletAccount,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useLanguage } from '@hooks/language'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { OnboardingStackParamList } from '../../routes'
import { RootStackParamList } from '@routes/index'

type NameAccountScreenProps = NativeStackScreenProps<
    OnboardingStackParamList,
    'NameAccount'
>

export const NameAccountScreen = ({ route }: NameAccountScreenProps) => {
    const navigation =
        useNavigation<NativeStackNavigationProp<RootStackParamList>>()
    const styles = useStyles()
    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const { t } = useLanguage()
    const { deletePreference } = usePreferences()

    const routeAccount = route.params?.account

    const [account, setAccount] = useState<WalletAccount>(routeAccount)
    const numWallets = accounts.length
    const initialWalletName = getAccountDisplayName(account)
    const [walletDisplay, setWalletDisplay] =
        useState<string>(initialWalletName)

    const saveName = (value: string) => {
        account.name = value
        setAccount(account)
        setWalletDisplay(value)
        updateAccount(account)
    }

    const goToHome = () => {
        deletePreference(UserPreferences.isCreatingAccount)
        navigation.replace('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AccountDetails',
                params: { playConfetti: true },
            },
        })
    }

    return (
        <KeyboardAvoidingView
            style={styles.mainContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <PWText
                variant='h4'
                style={styles.helperText}
            >
                {t('onboarding.name_account.description')}
            </PWText>
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
                onChangeText={saveName}
                autoFocus
            />
            <PWView style={styles.spacer} />
            <PWButton
                style={styles.finishButton}
                variant='primary'
                title={t('onboarding.name_account.finish_button')}
                onPress={goToHome}
            />
        </KeyboardAvoidingView>
    )
}
