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

import { useTheme } from '@rneui/themed'
import QRCode from 'react-native-qrcode-svg'
import { PWButton, PWText, PWTouchableIcon, PWView } from '@components/core'
import { CopyableText } from '@components/CopyableText'
import { useLanguage } from '@hooks/useLanguage'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useClipboard } from '@hooks/useClipboard'

const QR_SIZE = 180

export type OnrampPayInCardProps = {
    /** Pay-in (deposit) address encoded in the QR and shown below it. */
    payInAddress: string
    /** Optional memo/destination tag some chains require alongside the address. */
    payInAddressTag?: Nullable<string>
    /** "{amount} {SRC}" subtext (e.g. "1 SOL"), or null to hide it. */
    sendToAddressAmount: Nullable<string>
    /** Source token logo rendered in the QR center, or null when unavailable. */
    sourceLogo: Nullable<string>
    /** Renders the "Cancel Order" action when provided. */
    onCancel?: () => void
    isCancelling?: boolean
}

const PayInAddressBlock = ({
    label,
    value,
}: {
    label: string
    value: string
}) => {
    const styles = useStyles()
    const { copyToClipboard } = useClipboard()

    return (
        <PWView style={styles.addressBlock}>
            <PWText
                variant='footnoteMedium'
                style={styles.addressLabel}
            >
                {label}
            </PWText>
            <CopyableText
                copyValue={value}
                style={styles.addressRow}
            >
                <PWText
                    variant='body'
                    style={styles.addressValue}
                >
                    {value}
                </PWText>
                <PWTouchableIcon
                    name='copy'
                    size='sm'
                    variant='secondary'
                    onPress={() => void copyToClipboard(value)}
                />
            </CopyableText>
        </PWView>
    )
}

export const OnrampPayInCard = ({
    payInAddress,
    payInAddressTag,
    sendToAddressAmount,
    sourceLogo,
    onCancel,
    isCancelling = false,
}: OnrampPayInCardProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    return (
        <PWView style={styles.payInCard}>
            <PWText
                variant='bodySemibold'
                style={styles.cardHeading}
            >
                {t('onramp.order_review.pay_in_address')}
            </PWText>
            {sendToAddressAmount !== null && (
                <PWText
                    variant='footnoteMedium'
                    style={styles.cardSubtext}
                >
                    {t('onramp.order_review.send_to_address', {
                        amount: sendToAddressAmount,
                    })}
                </PWText>
            )}

            <PWView style={styles.qrContainer}>
                <QRCode
                    value={payInAddress}
                    size={QR_SIZE}
                    color='black'
                    backgroundColor='white'
                    quietZone={theme.spacing.sm}
                    {...(sourceLogo ? { logo: { uri: sourceLogo } } : {})}
                />
            </PWView>

            <PayInAddressBlock
                label={t('onramp.order_review.address')}
                value={payInAddress}
            />

            {payInAddressTag ? (
                <PayInAddressBlock
                    label={t('onramp.order_review.address_tag_label')}
                    value={payInAddressTag}
                />
            ) : null}

            {onCancel ? (
                <>
                    <PWView style={styles.divider} />
                    <PWButton
                        variant='linkNeutral'
                        title={t('onramp.order_review.cancel_order')}
                        onPress={onCancel}
                        isLoading={isCancelling}
                        testID='onramp-cancel-order'
                    />
                </>
            ) : null}
        </PWView>
    )
}
