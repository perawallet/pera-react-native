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

import { useCallback, useState } from 'react'

import {
    decryptBackupSyncQr,
    type BackupSyncQrContents,
} from '@perawallet/wallet-core-backup'
import { useBottomSheetResult } from '@modules/bottom-sheet'

type UseBackupCodeSheetParams = {
    raw: string
}

type UseBackupCodeSheetResult = {
    hasError: boolean
    isDeriving: boolean
    handleCodeComplete: (code: string) => Promise<void>
    handleErrorAnimationComplete: () => void
}

export const useBackupCodeSheet = ({
    raw,
}: UseBackupCodeSheetParams): UseBackupCodeSheetResult => {
    const { resolve } = useBottomSheetResult<BackupSyncQrContents>()
    const [hasError, setHasError] = useState(false)
    const [isDeriving, setIsDeriving] = useState(false)

    const handleCodeComplete = useCallback(
        async (code: string) => {
            setIsDeriving(true)

            let contents: BackupSyncQrContents
            try {
                contents = await decryptBackupSyncQr(raw, code)
            } catch {
                // Reported as a wrong code: the envelope was validated at scan
                // time, and the one other reachable failure — the inner
                // argon2id block, which sits inside the ciphertext — is just as
                // unactionable for the user.
                setHasError(true)
                return
            } finally {
                setIsDeriving(false)
            }

            resolve(contents)
        },
        [raw, resolve],
    )

    const handleErrorAnimationComplete = useCallback(
        () => setHasError(false),
        [],
    )

    return {
        hasError,
        isDeriving,
        handleCodeComplete,
        handleErrorAnimationComplete,
    }
}
