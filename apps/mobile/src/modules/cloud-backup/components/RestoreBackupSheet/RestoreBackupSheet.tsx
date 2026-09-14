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
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { RestoreOptionRow } from './RestoreOptionRow'
import { useStyles } from './styles'

export type RestoreBackupSheetResult = 'scan' | 'manual'

export const RestoreBackupSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { resolve } = useBottomSheetResult<RestoreBackupSheetResult>()

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
                    {t('cloud_backup.restore.sheet_description')}
                </PWText>
                <PWView style={styles.options}>
                    <RestoreOptionRow
                        icon='qr'
                        label={t('cloud_backup.restore.sheet_scan')}
                        onPress={() => resolve('scan')}
                        testID='cloud_backup_restore_sheet_scan'
                    />
                    <RestoreOptionRow
                        icon='key'
                        label={t('cloud_backup.restore.sheet_manual')}
                        onPress={() => resolve('manual')}
                        testID='cloud_backup_restore_sheet_manual'
                    />
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
