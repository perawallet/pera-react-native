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
import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import { BACKUP_ACCESS_DOMAIN, useKMS } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import type { SerializePrivateKeyResolver } from '../sync/types'

/** Resolves null when the key is unavailable, which skips that account rather
 *  than backing it up without its secret. The caller zeroes the bytes. Only the
 *  error message is logged, never anything read. */
export const useResolvePrivateKeyForBackup =
    (): SerializePrivateKeyResolver => {
        const keystore = useKMS()

        return useCallback<SerializePrivateKeyResolver>(
            async (chainId, keyPairId) => {
                try {
                    if (!accountsChainAdapters.has(chainId)) return null
                    const { revealPrivateKey } =
                        accountsChainAdapters.get(chainId)
                    if (!revealPrivateKey) return null
                    return await revealPrivateKey(
                        keystore,
                        keyPairId,
                        BACKUP_ACCESS_DOMAIN,
                    )
                } catch (error) {
                    logger.warn(
                        'useResolvePrivateKeyForBackup: resolve failed',
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                    )
                    return null
                }
            },
            // `useKMS()` is re-created on every render, so this resolver is not
            // stable; the sync manager holds it behind a ref.
            [keystore],
        )
    }
