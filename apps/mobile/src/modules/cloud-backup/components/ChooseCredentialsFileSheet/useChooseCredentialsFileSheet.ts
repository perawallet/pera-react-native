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
import { backupCredentialsFileAddressPrefix } from '@perawallet/wallet-core-backup'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type CredentialsFileChoice = {
    fileName: string
    /** The backup's address prefix, or `null` for a file saved before names carried one. */
    addressPrefix: string | null
}

type UseChooseCredentialsFileSheetResult = {
    choices: CredentialsFileChoice[]
    handleSelect: (fileName: string) => void
}

export const useChooseCredentialsFileSheet = (
    fileNames: string[],
): UseChooseCredentialsFileSheetResult => {
    const { resolve } = useBottomSheetResult<string>()

    const choices = useMemo(
        () =>
            fileNames.map(fileName => ({
                fileName,
                addressPrefix: backupCredentialsFileAddressPrefix(fileName),
            })),
        [fileNames],
    )

    const handleSelect = useCallback(
        (fileName: string) => resolve(fileName),
        [resolve],
    )

    return { choices, handleSelect }
}
