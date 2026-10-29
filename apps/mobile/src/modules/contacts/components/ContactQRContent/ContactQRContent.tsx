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

import QRCode from 'react-native-qrcode-svg'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@rneui/themed'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { Contact } from '@perawallet/wallet-core-contacts'

import {
    PWButton,
    PWChip,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useContactQRContent } from './useContactQRContent'

export type ContactQRContentProps = {
    contact: Contact
    /** The family the sheet opens on; the first the contact holds otherwise. */
    initialFamily?: ChainFamily
}

export const ContactQRContent = ({
    contact,
    initialFamily,
}: ContactQRContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const { theme } = useTheme()
    const { width } = useWindowDimensions()
    const {
        familyOptions,
        selectedFamily,
        address,
        shortAddress,
        selectFamily,
        handleCopy,
        handleShare,
    } = useContactQRContent(contact, initialFamily)

    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: window width minus a 5xl margin on each side
    const qrSize = width - theme.spacing['5xl'] * 2

    return (
        <PWView
            style={styles.container}
            testID='contact_qr_sheet'
        >
            <PWView style={styles.header}>
                <PWText
                    variant='h4'
                    numberOfLines={1}
                    style={styles.title}
                >
                    {contact.name}
                </PWText>
            </PWView>
            {familyOptions.length > 0 ? (
                <PWView style={styles.chips}>
                    {familyOptions.map(({ family, label }) => (
                        <PWTouchableOpacity
                            key={family}
                            onPress={() => selectFamily(family)}
                            accessibilityState={{
                                selected: family === selectedFamily,
                            }}
                            testID={`contact_qr_family_${family}`}
                        >
                            <PWChip
                                title={label}
                                variant={
                                    family === selectedFamily
                                        ? 'helper'
                                        : 'outline'
                                }
                                forceUppercase={false}
                            />
                        </PWTouchableOpacity>
                    ))}
                </PWView>
            ) : null}
            <PWView style={styles.qrSection}>
                <PWView
                    accessibilityRole='image'
                    accessibilityLabel={t(
                        'contacts.list.qr_accessibility_label',
                        { name: contact.name },
                    )}
                >
                    <QRCode
                        value={address}
                        size={qrSize}
                        color={theme.colors.qrCodeFg}
                        backgroundColor={theme.colors.qrCodeBg}
                        quietZone={theme.spacing.sm}
                    />
                </PWView>
                <PWText
                    variant='h3'
                    style={styles.shortAddress}
                >
                    {shortAddress}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.fullAddress}
                >
                    {address}
                </PWText>
            </PWView>
            <PWView style={styles.actions}>
                <PWButton
                    title={t('contacts.list.qr_sheet_copy')}
                    variant='primary'
                    icon='copy'
                    onPress={handleCopy}
                    style={styles.actionButton}
                    testID='contact_qr_copy_button'
                />
                <PWButton
                    title={t('contacts.list.qr_sheet_share')}
                    variant='secondary'
                    icon='share'
                    onPress={() => void handleShare()}
                    style={styles.actionButton}
                    testID='contact_qr_share_button'
                />
            </PWView>
        </PWView>
    )
}
