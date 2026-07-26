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

import { useWindowDimensions } from 'react-native'
import { useTheme } from '@rneui/themed'
import QRCode from 'react-native-qrcode-svg'

import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useQRViewScreen } from './useQRViewScreen'
import { useStyles } from './styles'
import { getTestProps } from '@utils/test-id-helper'

export const QRViewScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { width } = useWindowDimensions()
    const { theme } = useTheme()
    const { onFinished } = useReceiveFunds()
    const {
        account,
        deeplink,
        canSelectAccount,
        handleBack,
        handleCopyAddress,
        handleShareAddress,
    } = useQRViewScreen()

    useNavigationHeader({
        left: (
            <PWIcon
                name={canSelectAccount ? 'chevron-left' : 'cross'}
                onPress={handleBack}
            />
        ),
        title: account ? (
            <PWText
                variant='h3'
                numberOfLines={1}
            >
                {getAccountDisplayName(account)}
            </PWText>
        ) : (
            ''
        ),
    })

    if (!account) {
        return (
            <EmptyView
                title={t('receive_funds.qrview.error_title')}
                body={t('receive_funds.qrview.error_body')}
                button={
                    <PWButton
                        title={t('common.go_back.label')}
                        variant='primary'
                        onPress={onFinished}
                    />
                }
            />
        )
    }

    return (
        <PWScreen
            scroll='never'
            footer={
                <PWView style={styles.buttonContainer}>
                    <PWButton
                        title={t('receive_funds.qrview.copy_address')}
                        variant='primary'
                        icon='copy'
                        testID='receive_copy_address_button'
                        onPress={handleCopyAddress}
                    />
                    <PWButton
                        title={t('receive_funds.qrview.share')}
                        variant='secondary'
                        icon='share'
                        testID='receive_share_address_button'
                        onPress={() => void handleShareAddress()}
                    />
                </PWView>
            }
        >
            <PWView style={styles.contentContainer}>
                <PWView style={styles.qrContainer}>
                    <QRCode
                        {...getTestProps('receive_qr_code')}
                        value={deeplink}
                        size={width - theme.spacing['5xl'] * 2}
                        color='black'
                        backgroundColor='white'
                        quietZone={theme.spacing.sm}
                    />
                </PWView>
                <PWView style={styles.addressContainer}>
                    <CopyableText
                        copyValue={account.address}
                        style={styles.addressButton}
                    >
                        <PWText style={styles.address}>
                            {account.address}
                        </PWText>
                    </CopyableText>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
