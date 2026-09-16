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

import { PWSheetLayout, PWText, PWView } from '@components/core'
import { PanelButton, type PanelButtonProps } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import iCloudLogo from '@assets/images/icloud-logo.png'
import {
    useRestoreBackupSheet,
    type RestoreBackupSheetResult,
} from './useRestoreBackupSheet'
import { useStyles } from './styles'

type OptionRow = Pick<
    PanelButtonProps,
    'leftIcon' | 'leftImage' | 'title' | 'testID'
>

export const RestoreBackupSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { options, descriptionKey, handleSelect } = useRestoreBackupSheet()

    const rows: Record<RestoreBackupSheetResult, OptionRow> = {
        scan: {
            leftIcon: 'qr',
            title: t('cloud_backup.restore.sheet_scan'),
            testID: 'cloud_backup_restore_sheet_scan',
        },
        device: {
            leftIcon: 'device',
            title: t('cloud_backup.restore.sheet_device'),
            testID: 'cloud_backup_restore_sheet_device',
        },
        icloud: {
            leftImage: iCloudLogo,
            title: t('cloud_backup.restore.sheet_icloud'),
            testID: 'cloud_backup_restore_sheet_icloud',
        },
        googleDrive: {
            leftIcon: 'google-drive',
            title: t('cloud_backup.restore.sheet_google_drive'),
            testID: 'cloud_backup_restore_sheet_google_drive',
        },
        manual: {
            leftIcon: 'key',
            title: t('cloud_backup.restore.sheet_manual'),
            testID: 'cloud_backup_restore_sheet_manual',
        },
    }

    return (
        <PWSheetLayout
            testID='cloud_backup_restore_sheet'
            header={
                <SheetHeader
                    title={t('cloud_backup.restore.sheet_title')}
                    showClose
                />
            }
        >
            <PWView style={styles.body}>
                <PWText
                    variant='bodyLarge'
                    style={styles.description}
                >
                    {t(descriptionKey)}
                </PWText>
                <PWView style={styles.options}>
                    {options.map(option => (
                        <PanelButton
                            key={option}
                            {...rows[option]}
                            titleWeight='h3'
                            accessibilityRole='button'
                            onPress={() => handleSelect(option)}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
