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

import { useCallback, useMemo } from 'react'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import type { CredentialsFileSource } from '../../storage'
import { getCredentialsFileReadSources } from '../../storage/credentialsFileSources'

export type RestoreBackupSheetResult = 'scan' | CredentialsFileSource | 'manual'

type UseRestoreBackupSheetResult = {
    options: RestoreBackupSheetResult[]
    descriptionKey: string
    handleSelect: (option: RestoreBackupSheetResult) => void
}

const EVENTS: Partial<Record<RestoreBackupSheetResult, CloudBackupEvent>> = {
    scan: CloudBackupEvent.RestoreScanQr,
    manual: CloudBackupEvent.RestoreEnterManually,
}

export const useRestoreBackupSheet = (): UseRestoreBackupSheetResult => {
    const { resolve } = useBottomSheetResult<RestoreBackupSheetResult>()
    const fileSources = getCredentialsFileReadSources()
    const options = useMemo<RestoreBackupSheetResult[]>(
        () => ['scan', ...fileSources, 'manual'],
        [fileSources],
    )

    const handleSelect = useCallback(
        (option: RestoreBackupSheetResult) => {
            const event = EVENTS[option]
            if (event) trackEvent(event)
            resolve(option)
        },
        [resolve],
    )

    return {
        options,
        descriptionKey:
            fileSources.length > 0
                ? 'cloud_backup.restore.sheet_description_with_import'
                : 'cloud_backup.restore.sheet_description',
        handleSelect,
    }
}
