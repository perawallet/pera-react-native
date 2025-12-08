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

import {
    ParamListBase,
    useNavigation,
    StaticScreenProps,
} from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStyles } from './NameAccountScreen.styles'
import { Input, Text } from '@rneui/themed'
import PWView from '../../../components/common/view/PWView'
import PWButton from '../../../components/common/button/PWButton'
import PWIcon from '../../../components/common/icons/PWIcon'

import {
    useAllAccounts,
    getAccountDisplayName,
    WalletAccount,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useLanguage } from '../../../hooks/useLanguage'

type NameAccountScreenProps = StaticScreenProps<{
    account: WalletAccount
}>

const NameAccountScreen = ({ route }: NameAccountScreenProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const styles = useStyles()
    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const { t } = useLanguage()

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
        navigation.replace('TabBar', {
            screen: 'Home',
        })
    }

    return (
        <KeyboardAvoidingView
            style={styles.mainContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Text
                h4
                style={styles.helperText}
            >
                {t('onboarding.name_account.description')}
            </Text>
            <PWView style={styles.walletNameContainer}>
                <PWIcon
                    name='wallet'
                    variant='secondary'
                />
                <Text
                    h4
                    style={styles.nameText}
                >{t('onboarding.name_account.wallet_label', { count: numWallets + 1 })}</Text>
            </PWView>
            <Input
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

export default NameAccountScreen
