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

import { useLanguage } from '@hooks/useLanguage'

import { BackupCodeEntry } from '../BackupCodeEntry'
import { useBackupCodeSheet } from './useBackupCodeSheet'

export type BackupCodeSheetProps = {
    /** The scanned envelope, already validated by `parseBackupSyncQrEnvelope`. */
    raw: string
}

export const BackupCodeSheet = ({ raw }: BackupCodeSheetProps) => {
    const { t } = useLanguage()

    const {
        hasError,
        isDeriving,
        handleCodeComplete,
        handleErrorAnimationComplete,
    } = useBackupCodeSheet({ raw })

    return (
        <BackupCodeEntry
            testID='backup_code_sheet'
            title={t('cloud_backup.restore_scan.code_title')}
            description={t('cloud_backup.restore_scan.code_description')}
            onCodeComplete={code => void handleCodeComplete(code)}
            isDisabled={isDeriving}
            hasError={hasError}
            onErrorAnimationComplete={handleErrorAnimationComplete}
        />
    )
}
