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

import { useWindowDimensions } from 'react-native'
import { useTheme } from '@rneui/themed'
import QRCode from 'react-native-qrcode-svg'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useExportShareAccountBottomSheet } from './useExportShareAccountBottomSheet'
import { useStyles } from './styles'

export type ExportShareAccountBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    accountAddress: string
}

export const ExportShareAccountBottomSheet = ({
    isVisible,
    onClose,
    accountAddress,
}: ExportShareAccountBottomSheetProps) => {
    const { t } = useLanguage()
    const { width } = useWindowDimensions()
    const { theme } = useTheme()
    const styles = useStyles()
    const { exportUrl, handleCopyUrl, handleShareUrl } =
        useExportShareAccountBottomSheet({ accountAddress })

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onClose}
            enablePanDownToClose
            size='auto'
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            onPress={onClose}
                        />
                    }
                    center={
                        <PWText variant='h3'>
                            {t('multisig.export.title')}
                        </PWText>
                    }
                    paddingStyle='dense'
                />
                <PWView style={styles.qrSection}>
                    <QRCode
                        value={exportUrl}
                        size={width - theme.spacing['5xl'] * 2}
                    />
                    <PWText
                        variant='h3'
                        style={styles.label}
                    >
                        {t('multisig.export.url_label')}
                    </PWText>
                    <PWText style={styles.url}>{exportUrl}</PWText>
                </PWView>
                <PWView style={styles.actions}>
                    <PWButton
                        title={t('multisig.export.copy_url')}
                        variant='primary'
                        icon='copy'
                        onPress={handleCopyUrl}
                    />
                    <PWButton
                        title={t('multisig.export.share_url')}
                        variant='secondary'
                        icon='share'
                        onPress={handleShareUrl}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
