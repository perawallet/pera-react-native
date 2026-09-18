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
import { PanelButton } from '@components/PanelButton'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'

import { StoreCredentialsWarning } from './StoreCredentialsWarning'
import { useStoreBackupCredentialsSheet } from './useStoreBackupCredentialsSheet'
import { useStyles } from './styles'

export const StoreBackupCredentialsSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { destinations } = useStoreBackupCredentialsSheet()

    return (
        <PWSheetLayout
            testID='store_backup_credentials_sheet'
            header={
                <SheetHeader
                    testID='store_backup_credentials_sheet_header'
                    title={t('cloud_backup.store_credentials.title')}
                    showClose
                />
            }
        >
            <PWView style={styles.body}>
                <PWText variant='bodyLarge'>
                    {t('cloud_backup.store_credentials.description')}
                </PWText>
                <StoreCredentialsWarning />
                <PWView style={styles.options}>
                    {destinations.map(({ destination, ...row }) => (
                        <PanelButton
                            key={destination}
                            {...row}
                            titleWeight='h3'
                            accessibilityRole='button'
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
