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
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { useMemo } from 'react'
import {
    DEFAULT_PRECISION,
    formatCurrency,
} from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { Decimal } from 'decimal.js'

export type RejectConfirmBottomSheetProps = {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    /** ALGO refund amount in microAlgos (base units) */
    microAlgoRefundAmount: Decimal
}

export const RejectConfirmBottomSheet = ({
    isOpen,
    onClose,
    onConfirm,
    microAlgoRefundAmount,
}: RejectConfirmBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const deviceInfo = usePeraProvider().deviceInfo

    const algoDisplayAmount = useMemo(() => {
        return formatCurrency(
            baseUnitsToDisplayUnits(microAlgoRefundAmount, ALGO_ASSET.decimals),
            ALGO_ASSET.decimals,
            'ALGO',
            deviceInfo.getDeviceLocale(),
            false,
            false,
            DEFAULT_PRECISION,
        )
    }, [microAlgoRefundAmount, deviceInfo.getDeviceLocale])

    return (
        <PWBottomSheet
            isVisible={isOpen}
            onBackdropPress={onClose}
            innerContainerStyle={styles.bottomSheetContainer}
            enablePanDownToClose
        >
            <PWIcon
                name='warning'
                variant='error'
                size='xl'
                style={styles.bottomSheetIcon}
            />
            <PWText variant='h3'>{t('messages.claim.reject_title')}</PWText>
            <PWText style={styles.bottomSheetMessage}>
                {t('messages.claim.reject_body', {
                    algoAmount: algoDisplayAmount,
                })}
            </PWText>
            <PWView style={styles.bottomSheetActions}>
                <PWButton
                    variant='primary'
                    title={t('messages.claim.reject')}
                    onPress={onConfirm}
                    paddingStyle='dense'
                />
                <PWButton
                    variant='secondary'
                    title={t('messages.claim.reject_cancel')}
                    onPress={onClose}
                    paddingStyle='dense'
                />
            </PWView>
        </PWBottomSheet>
    )
}
