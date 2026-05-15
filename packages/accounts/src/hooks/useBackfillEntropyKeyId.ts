/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { useAccountsStore } from '../store'
import { isHDWalletAccount } from '../utils'

/**
 * One-shot migration that backfills `entropyKeyId` on HD accounts created
 * before the field was reliably propagated.
 *
 * Background: HD accounts added via the discover-and-import flow (and via
 * `createHdWalletAccount` when the root key already existed) were saved with
 * `entropyKeyId === undefined`. The mnemonic-backup grouping uses
 * `entropyKeyId` as the dedup key, so missing it produces a "sibling dedup
 * will be broken" warning per render and breaks per-wallet backup state.
 *
 * Fix: for each wallet group (keyPairId), if any sibling has `entropyKeyId`
 * set, copy it to the rest. If no sibling has it, this hook does nothing —
 * the user can re-import the wallet to recover (the import flow always sets
 * the field on the master account).
 *
 * Safe to run on every mount: idempotent (no-op once all siblings agree).
 */
type UseBackfillEntropyKeyIdResult = void

export const useBackfillEntropyKeyId = (): UseBackfillEntropyKeyIdResult => {
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)

    useEffect(() => {
        if (accounts.length === 0) return

        const entropyByWalletId = new Map<string, string>()
        for (const acc of accounts) {
            if (
                isHDWalletAccount(acc) &&
                acc.entropyKeyId &&
                !entropyByWalletId.has(acc.keyPairId)
            ) {
                entropyByWalletId.set(acc.keyPairId, acc.entropyKeyId)
            }
        }

        let backfilled = 0
        const next = accounts.map(acc => {
            if (
                !isHDWalletAccount(acc) ||
                acc.entropyKeyId ||
                !entropyByWalletId.has(acc.keyPairId)
            ) {
                return acc
            }
            backfilled++
            return {
                ...acc,
                entropyKeyId: entropyByWalletId.get(acc.keyPairId),
            }
        })

        if (backfilled > 0) {
            logger.info('Backfilled entropyKeyId on HD accounts', {
                source: 'useBackfillEntropyKeyId',
                backfilled,
            })
            setAccounts(next)
        }
    }, [accounts, setAccounts])
}
