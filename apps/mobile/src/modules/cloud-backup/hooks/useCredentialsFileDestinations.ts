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
import { useLanguage } from '@hooks/useLanguage'
import type { OptionListOption } from '@components/OptionList'
import { CREDENTIALS_FILE_SOURCE_ICONS } from '../components/credentialsFileSourceIcons'
import type { CredentialsFileSource } from '../storage'
import { useCredentialsFileSaveSources } from './useCredentialsFileSources'

const TITLE_KEYS: Record<CredentialsFileSource, string> = {
    device: 'cloud_backup.store_credentials.store_locally',
    icloud: 'cloud_backup.store_credentials.icloud',
    googleDrive: 'cloud_backup.store_credentials.google_drive',
}

const TEST_IDS: Record<CredentialsFileSource, string> = {
    device: 'store_backup_credentials_local',
    icloud: 'store_backup_credentials_icloud',
    googleDrive: 'store_backup_credentials_google_drive',
}

export const useCredentialsFileDestinations = (
    onSelect: (destination: CredentialsFileSource) => void,
): OptionListOption[] => {
    const { t } = useLanguage()
    const sources = useCredentialsFileSaveSources()

    return useMemo(
        () =>
            sources.map(destination => ({
                key: destination,
                ...CREDENTIALS_FILE_SOURCE_ICONS[destination],
                title: t(TITLE_KEYS[destination]),
                testID: TEST_IDS[destination],
                onPress: () => onSelect(destination),
            })),
        [sources, t, onSelect],
    )
}
