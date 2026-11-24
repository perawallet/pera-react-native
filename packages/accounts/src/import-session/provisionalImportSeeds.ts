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

import { clearProvisionalSeed } from '@perawallet/wallet-core-kms'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { KeystoreSnapshot } from '../credentials/credentialScheme'
import type { WalletAccount } from '../models'
import { useAccountsStore } from '../store'

const referencedKeys = (
    accounts: readonly WalletAccount[],
    keys: KeystoreSnapshot,
): ReadonlySet<string> => {
    const byId = new Map(keys.map(key => [key.id, key]))
    const referenced = new Set<string>()
    for (const account of accounts) {
        for (const entry of Object.values(account.chains)) {
            let id = entry?.keyPairId
            while (id !== undefined && !referenced.has(id)) {
                referenced.add(id)
                const parent: unknown = (
                    byId.get(id)?.metadata as Optional<Record<string, unknown>>
                )?.parentKeyId
                id = typeof parent === 'string' ? parent : undefined
            }
        }
    }
    return referenced
}

export const getPasskeyAnchorSeedIds = (
    keys: KeystoreSnapshot,
): ReadonlySet<string> =>
    useAccountsStore.persist.hasHydrated()
        ? referencedKeys(
              useAccountsStore
                  .getState()
                  .accounts.filter(
                      account =>
                          account.custody.kind === 'local' &&
                          account.custody.seed === 'bip39',
                  ),
              keys,
          )
        : new Set()

/** True when rollback removed the seed and a retry must save it again. */
export const discardUnclaimedImportSeed = async (
    seedId: string,
    removeKeyAndChildren: (id: string) => Promise<void>,
): Promise<boolean> => {
    if (!useAccountsStore.persist.hasHydrated()) return false
    const keys = getKeystoreStore().state.keys
    const claimed = referencedKeys(
        useAccountsStore.getState().accounts,
        keys,
    ).has(seedId)
    if (!claimed) await removeKeyAndChildren(seedId)
    clearProvisionalSeed(seedId)
    return !claimed
}
