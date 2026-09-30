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
import { isAndroid, isIOS } from '@utils/platform'
import type { CredentialsFileSource } from '../../storage'
import { useCredentialsFileReadSources } from '../../hooks/useCredentialsFileSources'

export type RestoreBackupSheetResult = 'scan' | CredentialsFileSource | 'manual'

export const useRestoreBackupChoices = (): RestoreBackupSheetResult[] => {
    const fileSources = useCredentialsFileReadSources()

    return useMemo(
        () => [
            // The backup QR is shown on a phone; pointing it at a desktop
            // webcam isn't a flow worth offering in the extension.
            ...(isIOS() || isAndroid() ? (['scan'] as const) : []),
            ...fileSources,
            'manual',
        ],
        [fileSources],
    )
}
