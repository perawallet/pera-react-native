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

import React, { useCallback, useEffect } from 'react'
import {
    BackupSyncQrUnsupportedVersionError,
    parseBackupSyncQrEnvelope,
    useCloudBackupRestoreDraftStore,
    useRestoreCloudBackupMutation,
    type BackupSyncQrContents,
} from '@perawallet/wallet-core-backup'
import { scannerNotifier } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { BackupCodeSheet } from '../../components/BackupCodeSheet'
import { useRestoreOutcome } from '../../hooks/useRestoreOutcome'

type Translate = ReturnType<typeof useLanguage>['t']

const scanFailureToast = (t: Translate, isUnsupportedVersion: boolean) => ({
    title: t(
        isUnsupportedVersion
            ? 'cloud_backup.restore_scan.unsupported_version_title'
            : 'cloud_backup.restore_scan.invalid_qr_title',
    ),
    body: t(
        isUnsupportedVersion
            ? 'cloud_backup.restore_scan.unsupported_version_body'
            : 'cloud_backup.restore_scan.invalid_qr_body',
    ),
    type: 'error' as const,
})

export type UseCloudBackupRestoreScanScreenParams = {
    onDone: () => void
}

export type UseCloudBackupRestoreScanScreenResult = {
    isScannerVisible: boolean
    isRestoring: boolean
    handleScanned: (raw: string, restartScanning: () => void) => Promise<void>
    handleScanSuccess: (raw: string, restartScanning: () => void) => void
    handleOpenScanner: () => void
    handleCloseScanner: () => void
}

export const useCloudBackupRestoreScanScreen = ({
    onDone,
}: UseCloudBackupRestoreScanScreenParams): UseCloudBackupRestoreScanScreenResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { request: requestBottomSheet } = useBottomSheet()
    const setMnemonic = useCloudBackupRestoreDraftStore(
        state => state.setMnemonic,
    )
    const setSalt = useCloudBackupRestoreDraftStore(state => state.setSalt)
    const clearDraft = useCloudBackupRestoreDraftStore(
        state => state.clearDraft,
    )

    // Scrubs the scanned phrase however the screen is left — a failed restore
    // and a back-out both stop here, and clearing twice is harmless.
    useEffect(() => () => clearDraft(), [clearDraft])

    // Closed on mount: the screen body explains what to do on the other
    // device first, and the OS camera prompt is meaningless without it.
    const {
        isOpen: isScannerVisible,
        open: handleOpenScanner,
        close: handleCloseScanner,
    } = useModalState()

    const outcome = useRestoreOutcome({ clearDraft, onDone })
    const { mutate: restore, isPending: isRestoring } =
        useRestoreCloudBackupMutation(outcome)

    const handleScanned = useCallback(
        async (raw: string, restartScanning: () => void) => {
            try {
                parseBackupSyncQrEnvelope(raw)
            } catch (error) {
                showToast(
                    scanFailureToast(
                        t,
                        error instanceof BackupSyncQrUnsupportedVersionError,
                    ),
                    // The camera is its own OS window, so a toast on the global
                    // notifier stays hidden behind it until the scanner closes.
                    { notifier: scannerNotifier.current ?? undefined },
                )
                restartScanning()
                return
            }

            // The sheet renders in the app's root tree, below that camera
            // window, so the scanner has to go before the code can be asked
            // for. Reopening it is what resumes scanning from here on.
            handleCloseScanner()

            const contents = await requestBottomSheet<BackupSyncQrContents>({
                contents: <BackupCodeSheet raw={raw} />,
                options: {
                    size: 'full',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })

            if (!contents) {
                handleOpenScanner()
                return
            }

            setMnemonic(contents.mnemonic.split(' '))
            setSalt(contents.backupSalt)
            // The envelope carries the parameters the backup was created
            // under; deriving on this build's defaults instead would yield a
            // different backupId and surface as bad credentials.
            restore({
                salt: contents.backupSalt,
                argon2id: contents.argon2id,
            })
        },
        [
            t,
            showToast,
            handleCloseScanner,
            handleOpenScanner,
            requestBottomSheet,
            setMnemonic,
            setSalt,
            restore,
        ],
    )

    // Stable identity: QRScannerView memoises the native barcode callback
    // on this, and an inline arrow at the call site would rebuild the
    // camera output every render.
    const handleScanSuccess = useCallback(
        (raw: string, restartScanning: () => void) =>
            void handleScanned(raw, restartScanning),
        [handleScanned],
    )

    return {
        isScannerVisible,
        isRestoring,
        handleScanned,
        handleScanSuccess,
        handleOpenScanner,
        handleCloseScanner,
    }
}
