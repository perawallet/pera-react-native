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

import React from 'react'
import {
    PWBottomSheet,
    PWIcon,
    PWListItem,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useTranslation } from 'react-i18next'

export type ImportAccountSupportOptionsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onPastePassphrase: () => void
    onScanQRCode: () => void
    onLearnMore: () => void
}

export const ImportAccountSupportOptionsBottomSheet = ({
    isVisible,
    onClose,
    onPastePassphrase,
    onScanQRCode,
    onLearnMore,
}: ImportAccountSupportOptionsBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useTranslation()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
        >
            <PWView style={styles.container}>
                <PWView style={styles.header}>
                    <PWTouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                    >
                        <PWIcon
                            name='cross'
                            variant='secondary'
                        />
                    </PWTouchableOpacity>

                    <PWText variant='h4'>
                        {t('onboarding.import_account.support_options.title')}
                    </PWText>
                </PWView>

                <PWView style={styles.optionsContainer}>
                    <PWListItem
                        icon='text-document'
                        title={t(
                            'onboarding.import_account.support_options.paste_passphrase',
                        )}
                        onPress={onPastePassphrase}
                    />
                    <PWListItem
                        icon='camera'
                        title={t(
                            'onboarding.import_account.support_options.scan_qr',
                        )}
                        onPress={onScanQRCode}
                    />
                    <PWListItem
                        icon='info'
                        title={t(
                            'onboarding.import_account.support_options.learn_more',
                        )}
                        onPress={onLearnMore}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
