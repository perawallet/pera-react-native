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

import { useCallback } from 'react'
import QRCode from 'react-native-qrcode-svg'
import { useWindowDimensions } from 'react-native'
import { useTheme } from '@rneui/themed'
import { Contact } from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import { PWButton, PWText, PWView } from '@components/core'
import { SHORT_ADDRESS_FORMAT } from '@constants/ui'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { shareText } from '@utils/shareText'
import { useStyles } from './styles'

export type ContactQRContentProps = {
    contact: Contact
}

export const ContactQRContent = ({ contact }: ContactQRContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()
    const { width } = useWindowDimensions()
    const { copyToClipboard } = useClipboard()

    const qrSize = width - theme.spacing['5xl'] * 2

    const handleCopy = useCallback(() => {
        copyToClipboard(contact.address)
    }, [contact, copyToClipboard])

    const handleShare = useCallback(async () => {
        try {
            await shareText({
                title: contact.name,
                message: contact.address,
            })
        } catch {
            // User cancelled — ignore.
        }
    }, [contact])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWText
                    variant='h4'
                    numberOfLines={1}
                    style={styles.title}
                >
                    {contact.name}
                </PWText>
            </PWView>
            <PWView style={styles.qrSection}>
                <PWView
                    accessibilityRole='image'
                    accessibilityLabel={t(
                        'contacts.list.qr_accessibility_label',
                        { name: contact.name },
                    )}
                >
                    <QRCode
                        value={contact.address}
                        size={qrSize}
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.shortAddress}
                >
                    {truncateAlgorandAddress(
                        contact.address,
                        SHORT_ADDRESS_FORMAT,
                    )}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.fullAddress}
                >
                    {contact.address}
                </PWText>
            </PWView>
            <PWView style={styles.actions}>
                <PWButton
                    title={t('contacts.list.qr_sheet_copy')}
                    variant='primary'
                    icon='copy'
                    onPress={handleCopy}
                    style={styles.actionButton}
                />
                <PWButton
                    title={t('contacts.list.qr_sheet_share')}
                    variant='secondary'
                    icon='share'
                    onPress={handleShare}
                    style={styles.actionButton}
                />
            </PWView>
        </PWView>
    )
}
