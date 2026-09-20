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
import { OptionListSheet } from '../OptionListSheet'
import { StoreCredentialsWarning } from './StoreCredentialsWarning'
import { useStoreBackupCredentialsSheet } from './useStoreBackupCredentialsSheet'

export const StoreBackupCredentialsSheet = () => {
    const { t } = useLanguage()
    const { destinations } = useStoreBackupCredentialsSheet()

    return (
        <OptionListSheet
            testID='store_backup_credentials_sheet'
            title={t('cloud_backup.store_credentials.title')}
            description={t('cloud_backup.store_credentials.description')}
            isDescriptionMuted={false}
            options={destinations}
        >
            <StoreCredentialsWarning />
        </OptionListSheet>
    )
}
