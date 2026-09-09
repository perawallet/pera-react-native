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

import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { getTestProps } from '@utils/test-id-helper'

import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'backup-sync-qr'

export type SyncDevicesQrSheetProps = {
    /** Ciphertext envelope — safe to hold, but still shielded from capture. */
    payload: string
}

export const SyncDevicesQrSheet = ({ payload }: SyncDevicesQrSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()
    const { width } = useWindowDimensions()
    const { dismiss } = useBottomSheetResult()

    usePreventScreenCapture(SCREEN_CAPTURE_TAG, true)

    const qrSize = width - theme.spacing['5xl'] * 2

    return (
        <PWSheetLayout
            testID='sync_devices_qr_sheet'
            header={
                <SheetHeader
                    title={t('cloud_backup.sync_devices.title')}
                    showClose
                />
            }
            footer={
                <PWButton
                    variant='primary'
                    title={t('common.close.label')}
                    onPress={dismiss}
                    testID='sync_devices_qr_close_button'
                />
            }
        >
            <PWView style={styles.body}>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.sync_devices.description')}
                </PWText>
                <QRCode
                    {...getTestProps('sync_devices_qr_code')}
                    value={payload}
                    size={qrSize}
                    color='black'
                    backgroundColor='white'
                    quietZone={theme.spacing.sm}
                />
                <PWText
                    variant='body'
                    style={styles.warning}
                >
                    {t('cloud_backup.sync_devices.warning')}
                </PWText>
            </PWView>
        </PWSheetLayout>
    )
}
