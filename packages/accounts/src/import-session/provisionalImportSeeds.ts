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
import {
    getKeystoreStore,
    isPasskeyCredentialType,
} from '@perawallet/wallet-extension-provider'
import type { KeystoreSnapshot } from '../credentials/credentialScheme'
import type { WalletAccount } from '../models'
import { useAccountsStore } from '../store'

const keyAncestors = (
    keyIds: readonly string[],
    keys: KeystoreSnapshot,
): ReadonlySet<string> => {
    const byId = new Map(keys.map(key => [key.id, key]))
    const referenced = new Set<string>()
    for (const keyId of keyIds) {
        let id: Optional<string> = keyId
        while (id !== undefined && !referenced.has(id)) {
            referenced.add(id)
            const parent: unknown = byId.get(id)?.metadata?.parentKeyId
            id = typeof parent === 'string' ? parent : undefined
        }
    }
    return referenced
}

const accountKeyIds = (accounts: readonly WalletAccount[]): string[] =>
    accounts.flatMap(account =>
        Object.values(account?.chains ?? {}).flatMap(entry =>
            typeof entry?.keyPairId === 'string' ? entry.keyPairId : [],
        ),
    )

export const getPasskeyAnchorSeedIds = (
    keys: KeystoreSnapshot,
): ReadonlySet<string> =>
    useAccountsStore.persist.hasHydrated()
        ? keyAncestors(
              accountKeyIds(
                  useAccountsStore
                      .getState()
                      .accounts.filter(
                          account =>
                              account?.custody?.kind === 'local' &&
                              account.custody.seed === 'bip39',
                      ),
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
    const claimed = keyAncestors(
        [
            ...accountKeyIds(useAccountsStore.getState().accounts),
            // Existing credentials can still need the seed for assertion
            // derivation or PRF. Only account ancestry authorizes new ones.
            ...keys
                .filter(key => isPasskeyCredentialType(key.type))
                .map(key => key.id),
        ],
        keys,
    ).has(seedId)
    if (!claimed) await removeKeyAndChildren(seedId)
    clearProvisionalSeed(seedId)
    return !claimed
}
