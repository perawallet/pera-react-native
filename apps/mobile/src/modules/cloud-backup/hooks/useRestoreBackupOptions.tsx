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

import { useCallback, useRef, useState } from 'react'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    RestoreBackupSheet,
    type RestoreBackupSheetResult,
} from '../components/RestoreBackupSheet'
import type { CloudBackupRestoreKeyParams } from '../routes/types'
import { readBackupCredentials, type CredentialsFileSource } from '../storage'

/** Arguments for `navigate`/`push`, so each caller keeps its own stack's navigation. */
export type RestoreRoute =
    | [screen: 'CloudBackupRestoreScan', params?: undefined]
    | [
          screen: 'CloudBackupRestorePassphrase',
          params?: CloudBackupRestoreKeyParams,
      ]

type UseRestoreBackupOptionsResult = {
    chooseRestoreRoute: () => Promise<Nullable<RestoreRoute>>
    isReadingCredentials: boolean
}

export const useRestoreBackupOptions = (): UseRestoreBackupOptionsResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { showError } = useErrorToast()
    const { request: requestBottomSheet } = useBottomSheet()
    const [isReadingCredentials, setIsReadingCredentials] = useState(false)
    // A double tap would otherwise open two sheets and race two pickers.
    const isBusyRef = useRef(false)

    const importFrom = useCallback(
        async (
            source: CredentialsFileSource,
        ): Promise<Nullable<RestoreRoute>> => {
            try {
                const result = await readBackupCredentials(source, () =>
                    setIsReadingCredentials(true),
                )
                if (result.status === 'cancelled') return null
                // The user may have left while the file was read; navigating
                // now would open the restore over wherever they went.
                if (!navigation.isFocused()) return null
                return [
                    'CloudBackupRestorePassphrase',
                    { importedKey: result.key },
                ]
            } catch (error) {
                logger.error(
                    'useRestoreBackupOptions: failed to read the encryption key',
                    { source, error },
                )
                showError(error, t('cloud_backup.restore.import_error'))
                return null
            } finally {
                setIsReadingCredentials(false)
            }
        },
        [navigation, showError, t],
    )

    const chooseRestoreRoute = useCallback(async (): Promise<
        Nullable<RestoreRoute>
    > => {
        if (isBusyRef.current) return null
        isBusyRef.current = true
        try {
            const choice = await requestBottomSheet<RestoreBackupSheetResult>({
                contents: <RestoreBackupSheet />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!choice) return null
            if (choice === 'scan') return ['CloudBackupRestoreScan']
            if (choice === 'manual') return ['CloudBackupRestorePassphrase']
            return await importFrom(choice)
        } finally {
            isBusyRef.current = false
        }
    }, [requestBottomSheet, importFrom])

    return { chooseRestoreRoute, isReadingCredentials }
}
