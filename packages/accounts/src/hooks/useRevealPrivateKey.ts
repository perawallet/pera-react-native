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

import { BACKUP_ACCESS_DOMAIN, useKMS } from '@perawallet/wallet-core-kms'
import { standaloneSecretOf } from '../credentials/accessors'
import { PrivateKeyRevealUnsupportedError } from '../errors'
import { useAccountsStore } from '../store'
import { isStandaloneAccount } from '../utils'

export type UseRevealPrivateKeyResult = {
    /**
     * Resolves `null` when `authenticate` resolves false. The caller zeroes the
     * returned bytes. Throws before `authenticate` runs for an account that
     * holds no revealable private key.
     */
    revealPrivateKey: (
        accountId: string,
        authenticate: () => Promise<boolean>,
    ) => Promise<Uint8Array | null>
}

export const useRevealPrivateKey = (): UseRevealPrivateKeyResult => {
    const { exportSecp256k1Key } = useKMS()

    const revealPrivateKey = async (
        accountId: string,
        authenticate: () => Promise<boolean>,
    ) => {
        const account = useAccountsStore
            .getState()
            .accounts.find(a => a.id === accountId)
        const entries = Object.values(account?.chains ?? {})
        const keyPairId =
            entries.length === 1 ? entries[0]?.keyPairId : undefined
        if (
            !account ||
            !isStandaloneAccount(account) ||
            standaloneSecretOf(account) !== 'privateKey' ||
            !keyPairId
        ) {
            throw new PrivateKeyRevealUnsupportedError(accountId)
        }
        if (!(await authenticate())) return null
        return exportSecp256k1Key(keyPairId, BACKUP_ACCESS_DOMAIN)
    }

    return { revealPrivateKey }
}
