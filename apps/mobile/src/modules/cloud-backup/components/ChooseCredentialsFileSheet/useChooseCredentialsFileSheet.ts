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
import { backupCredentialsFileAddressPrefix } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import type { OptionListSheetOption } from '../OptionListSheet'

type UseChooseCredentialsFileSheetResult = {
    choices: OptionListSheetOption[]
}

export const useChooseCredentialsFileSheet = (
    fileNames: string[],
): UseChooseCredentialsFileSheetResult => {
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<string>()

    const choices = useMemo(
        () =>
            fileNames.map(fileName => {
                // Null for a key saved before file names carried an address.
                const prefix = backupCredentialsFileAddressPrefix(fileName)
                return {
                    key: fileName,
                    leftIcon: 'key' as const,
                    title: prefix
                        ? t('cloud_backup.restore.choose_file_row', { prefix })
                        : t('cloud_backup.restore.choose_file_unknown'),
                    testID: `cloud_backup_choose_credentials_file_${fileName}`,
                    onPress: () => resolve(fileName),
                }
            }),
        [fileNames, t, resolve],
    )

    return { choices }
}
