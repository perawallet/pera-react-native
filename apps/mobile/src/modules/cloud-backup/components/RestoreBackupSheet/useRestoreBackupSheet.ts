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

import { useMemo } from 'react'
import type { PanelButtonProps } from '@components/PanelButton'
import type { OptionListOption } from '@components/OptionList'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { CREDENTIALS_FILE_SOURCE_ICONS } from '../credentialsFileSourceIcons'
import {
    useRestoreBackupChoices,
    type RestoreBackupSheetResult,
} from './useRestoreBackupChoices'

type UseRestoreBackupSheetResult = {
    options: OptionListOption[]
    description: string
}

const EVENTS: Partial<Record<RestoreBackupSheetResult, CloudBackupEvent>> = {
    scan: CloudBackupEvent.RestoreScanQr,
    manual: CloudBackupEvent.RestoreEnterManually,
}

const ROW_ICONS: Record<
    RestoreBackupSheetResult,
    Pick<PanelButtonProps, 'leftIcon' | 'leftImage'>
> = {
    scan: { leftIcon: 'qr' },
    ...CREDENTIALS_FILE_SOURCE_ICONS,
    manual: { leftIcon: 'key' },
}

const TITLE_KEYS: Record<RestoreBackupSheetResult, string> = {
    scan: 'cloud_backup.restore.sheet_scan',
    device: 'cloud_backup.restore.sheet_device',
    icloud: 'cloud_backup.restore.sheet_icloud',
    googleDrive: 'cloud_backup.restore.sheet_google_drive',
    manual: 'cloud_backup.restore.sheet_manual',
}

const TEST_IDS: Record<RestoreBackupSheetResult, string> = {
    scan: 'cloud_backup_restore_sheet_scan',
    device: 'cloud_backup_restore_sheet_device',
    icloud: 'cloud_backup_restore_sheet_icloud',
    googleDrive: 'cloud_backup_restore_sheet_google_drive',
    manual: 'cloud_backup_restore_sheet_manual',
}

// A manual-only list never reaches the sheet, so without scan there is always
// a file source to mention.
const describe = (choices: RestoreBackupSheetResult[]): string => {
    if (!choices.includes('scan')) {
        return 'cloud_backup.restore.sheet_description_import_or_manual'
    }
    const canImport = choices.some(
        choice => choice !== 'scan' && choice !== 'manual',
    )
    return canImport
        ? 'cloud_backup.restore.sheet_description_with_import'
        : 'cloud_backup.restore.sheet_description'
}

export const useRestoreBackupSheet = (): UseRestoreBackupSheetResult => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<RestoreBackupSheetResult>()
    const choices = useRestoreBackupChoices()

    const options = useMemo(
        () =>
            choices.map(option => ({
                key: option,
                ...ROW_ICONS[option],
                title: t(TITLE_KEYS[option]),
                testID: TEST_IDS[option],
                onPress: () => {
                    const event = EVENTS[option]
                    if (event) trackEvent(event)
                    resolve(option)
                },
            })),
        [choices, t, resolve],
    )

    return { options, description: t(describe(choices)) }
}
