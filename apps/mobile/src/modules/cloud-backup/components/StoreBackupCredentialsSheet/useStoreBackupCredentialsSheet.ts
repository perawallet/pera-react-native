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
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import iCloudLogo from '@assets/images/icloud-logo.png'
import type { CredentialsFileSource } from '../../storage'
import { useCredentialsFileSaveSources } from '../../hooks/useCredentialsFileSources'

type DestinationRow = Pick<
    PanelButtonProps,
    'leftIcon' | 'leftImage' | 'title' | 'testID' | 'onPress'
> & { destination: CredentialsFileSource }

type UseStoreBackupCredentialsSheetResult = {
    destinations: DestinationRow[]
}

const ROW_ICONS: Record<
    CredentialsFileSource,
    Pick<PanelButtonProps, 'leftIcon' | 'leftImage'>
> = {
    device: { leftIcon: 'device' },
    icloud: { leftImage: iCloudLogo },
    googleDrive: { leftIcon: 'google-drive' },
}

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

export const useStoreBackupCredentialsSheet =
    (): UseStoreBackupCredentialsSheetResult => {
        const { t } = useLanguage()
        const { resolve } = useBottomSheetResult<CredentialsFileSource>()
        const sources = useCredentialsFileSaveSources()

        const destinations = useMemo(
            () =>
                sources.map(destination => ({
                    destination,
                    ...ROW_ICONS[destination],
                    title: t(TITLE_KEYS[destination]),
                    testID: TEST_IDS[destination],
                    onPress: () => resolve(destination),
                })),
            [sources, t, resolve],
        )

        return { destinations }
    }
