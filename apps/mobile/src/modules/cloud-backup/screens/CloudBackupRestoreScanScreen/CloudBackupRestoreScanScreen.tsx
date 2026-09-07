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

import React from 'react'

import { LoadingView } from '@components/LoadingView'
import { QRScannerView } from '@components/QRScannerView'
import { ScreenHeader } from '@components/ScreenHeader'
import { PWButton, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'

import { useCloudBackupRestoreScanScreen } from './useCloudBackupRestoreScanScreen'
import { useStyles } from './styles'

export type CloudBackupRestoreScanScreenProps = {
    /** Where to go once the keys are in; see `useRestoreOutcome`. */
    onDone: () => void
}

export const CloudBackupRestoreScanScreen = ({
    onDone,
}: CloudBackupRestoreScanScreenProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        isScannerVisible,
        isRestoring,
        handleScanSuccess,
        handleOpenScanner,
        handleCloseScanner,
    } = useCloudBackupRestoreScanScreen({ onDone })

    return (
        <>
            <PWScreen testID='cloud_backup_restore_scan_screen'>
                <PWView style={styles.container}>
                    <ScreenHeader
                        title={t('cloud_backup.restore_scan.title')}
                        description={t(
                            'cloud_backup.restore_scan.instructions',
                        )}
                    />
                    {isRestoring ? (
                        <LoadingView variant='circle' />
                    ) : (
                        <PWButton
                            variant='primary'
                            title={t('cloud_backup.restore_scan.scan_button')}
                            icon='qr'
                            onPress={handleOpenScanner}
                            testID='cloud_backup_restore_scan_button'
                        />
                    )}
                </PWView>
            </PWScreen>

            <QRScannerView
                isVisible={isScannerVisible}
                onClose={handleCloseScanner}
                onSuccess={handleScanSuccess}
                animationType='slide'
                skipDeepLinkHandler
            />
        </>
    )
}
