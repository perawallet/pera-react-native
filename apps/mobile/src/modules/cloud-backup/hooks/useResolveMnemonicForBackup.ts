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

import { useCallback } from 'react'
import type { SerializeMnemonicResolver } from '@perawallet/wallet-core-backup'
import {
    BACKUP_ACCESS_DOMAIN,
    mnemonicIndexToWord,
    useKMS,
} from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'

/** Resolves null when the phrase is unavailable, which skips that account
 *  rather than backing it up without its secret. Words are materialized only
 *  inside the KMS session; the index buffer it hands over is zeroed on exit. */
export const useResolveMnemonicForBackup = (): SerializeMnemonicResolver => {
    const { executeWithMnemonic } = useKMS()

    return useCallback<SerializeMnemonicResolver>(
        async account => {
            try {
                return await executeWithMnemonic(
                    account.keyPairId,
                    BACKUP_ACCESS_DOMAIN,
                    indices =>
                        Array.from(indices, mnemonicIndexToWord).join(' '),
                )
            } catch (error) {
                logger.warn('useResolveMnemonicForBackup: resolve failed', {
                    error:
                        error instanceof Error ? error.message : String(error),
                })
                return null
            }
        },
        // `executeWithMnemonic` is re-created on every KMS render, so this
        // resolver is not stable — the sync manager holds it behind a ref.
        [executeWithMnemonic],
    )
}
