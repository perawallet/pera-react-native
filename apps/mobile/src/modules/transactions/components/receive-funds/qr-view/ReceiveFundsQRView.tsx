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

import PWView from '@components/view/PWView'
import { Text, useTheme } from '@rneui/themed'
import {
    getAccountDisplayName,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import EmptyView from '@components/empty-view/EmptyView'
import { useLanguage } from '@hooks/language'
import { useStyles } from './styles'
import PWHeader from '@components/header/PWHeader'
import PWButton from '@components/button/PWButton'
import { Share, useWindowDimensions } from 'react-native'
import useToast from '@hooks/toast'
import { config } from '@perawallet/wallet-core-config'
import { useClipboard } from '@hooks/clipboard'
import { useDeepLink } from '@hooks/deeplink'
import { useMemo } from 'react'
import QRCode from 'react-native-qrcode-svg'
import { bottomSheetNotifier } from '@components/bottom-sheet/PWBottomSheet'

type ReceiveFundsQRViewProps = {
    account?: WalletAccount
    onBack?: () => void
    onClose: () => void
}

const ReceiveFundsQRView = ({
    account,
    onBack,
    onClose,
}: ReceiveFundsQRViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()
    const { buildAccountDeeplink } = useDeepLink()
    const { width } = useWindowDimensions()
    const { theme } = useTheme()

    const deeplink = useMemo(() => {
        if (!account) {
            return ''
        }
        return buildAccountDeeplink(account)
    }, [account])

    const copyAddress = () => {
        copyToClipboard(account?.address ?? '')
    }

    const shareAddress = async () => {
        try {
            if (!account) {
                return
            }
            await Share.share({
                title: getAccountDisplayName(account),
                message: account.address,
            })
        } catch (error) {
            showToast(
                {
                    title: t('errors.general.title'),
                    body: config.debugEnabled
                        ? `${error}`
                        : t('errors.general.body'),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        }
    }

    if (!account) {
        return (
            <EmptyView
                title={t('receive_funds.qrview.error_title')}
                body={t('receive_funds.qrview.error_body')}
                button={
                    <PWButton
                        title={t('common.go_back.label')}
                        variant='primary'
                        onPress={onClose}
                    />
                }
            />
        )
    }
    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon={onBack ? 'chevron-left' : 'cross'}
                onLeftPress={onBack ? onBack : onClose}
            >
                <Text>{getAccountDisplayName(account)}</Text>
            </PWHeader>
            <PWView style={styles.qrContainer}>
                <QRCode
                    value={deeplink}
                    size={width - theme.spacing['4xl'] * 2}
                />
            </PWView>
            <PWView style={styles.addressContainer}>
                <Text h3>{getAccountDisplayName(account)}</Text>
                <Text style={styles.address}>{account.address}</Text>
            </PWView>
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('receive_funds.qrview.copy_address')}
                    variant='primary'
                    icon='copy'
                    onPress={copyAddress}
                />
                <PWButton
                    title={t('receive_funds.qrview.share')}
                    variant='secondary'
                    icon='share'
                    onPress={shareAddress}
                />
            </PWView>
        </PWView>
    )
}

export default ReceiveFundsQRView
