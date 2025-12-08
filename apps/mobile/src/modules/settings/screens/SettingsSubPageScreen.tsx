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

import { Text } from '@rneui/themed'

import { StaticScreenProps } from '@react-navigation/native'
import { Network, Networks } from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'
import { useStyles } from './SettingsSubPageScreen.styles'
import PWView from '../../../components/common/view/PWView'
import PWButton from '../../../components/common/button/PWButton'
import { useSettings } from '@perawallet/wallet-core-settings'
import {
    useDevice,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import {
    Transaction,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import useToast from '../../../hooks/toast'
import { useLanguage } from '../../../hooks/useLanguage'

export type SettingsSubPageScreenProps = StaticScreenProps<{
    title: string
}>

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
    const styles = useStyles()
    const { theme, setTheme } = useSettings()
    const { network, setNetwork } = useNetwork()
    const { addSignRequest } = useSigningRequest()
    const { registerDevice } = useDevice(network)
    const accounts = useAllAccounts()
    const queryClient = useQueryClient()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const toggleTheme = () => {
        if (theme === 'dark' || theme === 'system') {
            setTheme('light')
        } else {
            setTheme('dark')
        }
    }

    const toggleNetwork = async () => {
        let newNetwork: Network = Networks.mainnet
        if (network === Networks.mainnet) {
            newNetwork = Networks.testnet
        }
        setNetwork(newNetwork)
        await registerDevice(accounts.map(account => account.address))

        queryClient.invalidateQueries()
    }

    const createSignRequest = async () => {
        try {
            const tx: Transaction = {
                fee: 1000,
                'first-valid': 1000,
                'last-valid': 2000,
                sender: 'HS4UDE2JA2VLAL3HWXC3QJMCG4XCINHQFFCXH2JXCHYWAHLWEAKY26Z2SI',
                'tx-type': 'pay',
            }
            addSignRequest({
                txs: [[tx]],
            })
        } catch (error) {
            showToast({
                title: t('settings.sub_page.unexpected_error_title'),
                body: t('settings.sub_page.unexpected_error_body', {
                    error: `${error}`,
                }),
                type: 'error',
            })
        }
    }

    return (
        <PWView style={styles.container}>
            <Text>
                {t('settings.sub_page.description', {
                    title: route.params.title,
                })}
            </Text>

            <PWButton
                onPress={toggleTheme}
                title={t('settings.sub_page.toggle_theme')}
                variant='primary'
            />

            <PWButton
                onPress={toggleNetwork}
                title={t('settings.sub_page.toggle_network')}
                variant='primary'
            />

            <PWButton
                onPress={createSignRequest}
                title={t('settings.sub_page.simulate_signing_request')}
                variant='primary'
            />
        </PWView>
    )
}

export default SettingsSubPageScreen
