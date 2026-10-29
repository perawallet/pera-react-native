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

import LottieView from 'lottie-react-native'

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import peraTransactionLoading from '@assets/animations/pera-transaction-loading.json'
import { useStyles } from './styles'
import { useTransactionProcessingScreen } from './useTransactionProcessingScreen'

export const TransactionProcessingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        isHardwareSender,
        hardwareDeviceName,
        ledgerAppName,
        isAwaitingConfirmation,
        networkName,
    } = useTransactionProcessingScreen()

    // Hardware-wallet sends start with a silent BLE-scan / connect phase
    // (LedgerConnectionError after ~20s on a cold pair). Without a
    // device-aware copy here the user stares at "Sending the transaction"
    // until either the device prompts (and the LedgerSigningContent sheet
    // takes over) or the connect times out.
    const titleKey = isHardwareSender
        ? i18nKey('send_funds.processing.title_hardware')
        : i18nKey('send_funds.processing.title')
    const subtitleOf = () => {
        if (isHardwareSender) {
            return {
                key: hardwareDeviceName
                    ? i18nKey('send_funds.processing.subtitle_hardware')
                    : i18nKey(
                          'send_funds.processing.subtitle_hardware_noDevice',
                      ),
                params: {
                    deviceName: hardwareDeviceName,
                    appName: ledgerAppName,
                },
            }
        }
        if (isAwaitingConfirmation) {
            return {
                key: i18nKey('send_funds.processing.broadcast_subtitle'),
                params: { network: networkName },
            }
        }
        return {
            key: i18nKey('send_funds.processing.subtitle'),
            params: undefined,
        }
    }
    const subtitle = subtitleOf()

    return (
        <PWScreen scroll='never'>
            <PWView style={styles.contentContainer}>
                <PWView style={styles.spinnerCircle}>
                    <LottieView
                        autoPlay
                        loop
                        source={peraTransactionLoading}
                        style={styles.animation}
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t(titleKey)}
                </PWText>
                <PWText style={styles.subtitle}>
                    {t(subtitle.key, subtitle.params)}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
