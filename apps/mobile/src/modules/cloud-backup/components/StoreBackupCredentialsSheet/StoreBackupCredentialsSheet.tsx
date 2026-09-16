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

import type { CredentialsFileSource } from '../../storage'
import { StoreCredentialsWarning } from './StoreCredentialsWarning'
import { useStoreBackupCredentialsSheet } from './useStoreBackupCredentialsSheet'
import { useStyles } from './styles'

type DestinationRow = Pick<
    PanelButtonProps,
    'leftIcon' | 'leftImage' | 'title' | 'testID'
>

export const StoreBackupCredentialsSheet = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { destinations, handleSelect } = useStoreBackupCredentialsSheet()

    const rows: Record<CredentialsFileSource, DestinationRow> = {
        device: {
            leftIcon: 'device',
            title: t('cloud_backup.store_credentials.store_locally'),
            testID: 'store_backup_credentials_local',
        },
        icloud: {
            leftImage: iCloudLogo,
            title: t('cloud_backup.store_credentials.icloud'),
            testID: 'store_backup_credentials_icloud',
        },
        googleDrive: {
            leftIcon: 'google-drive',
            title: t('cloud_backup.store_credentials.google_drive'),
            testID: 'store_backup_credentials_google_drive',
        },
    }

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
                    {destinations.map(destination => (
                        <PanelButton
                            key={destination}
                            {...rows[destination]}
                            titleWeight='h3'
                            accessibilityRole='button'
                            onPress={() => handleSelect(destination)}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
