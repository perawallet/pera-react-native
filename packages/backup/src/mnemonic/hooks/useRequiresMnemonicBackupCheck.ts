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

import { useCallback, useEffect, useMemo } from 'react'
import {
    hasRecoverySeed,
    seedOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    resolveSeedKeyFrom,
    useKeystoreKeys,
} from '@perawallet/wallet-core-kms'
import { useMnemonicBackupStore } from '../store'

// Backup state lives on the seed, so every account one recovery phrase
// restores shares it, whichever chains it holds. An account with no phrase
// (watch, hardware, multisig, a raw private key) never requires one.
export const useRequiresMnemonicBackupCheck = (): ((
    account: WalletAccount,
) => boolean) => {
    const backedUpKeyIds = useMnemonicBackupStore(state => state.backedUpKeyIds)
    const upgradeBackedUpKeyIds = useMnemonicBackupStore(
        state => state.upgradeBackedUpKeyIds,
    )
    const keys = useKeystoreKeys()

    // A mark made under a signing child key counts for its seed; a mark whose
    // key is gone matches no seed. `upgrades` maps each such child key to its
    // seed so the mark can be saved under the seed instead.
    const { backedUpSeedIds, upgrades } = useMemo(() => {
        const seedIds = new Set<string>()
        const seedIdByKeyId: Record<string, string> = {}
        for (const markedId of Object.keys(backedUpKeyIds)) {
            try {
                const seedId = resolveSeedKeyFrom(keys, markedId).id
                seedIds.add(seedId)
                if (seedId !== markedId) seedIdByKeyId[markedId] = seedId
            } catch {
                continue
            }
        }
        return { backedUpSeedIds: seedIds, upgrades: seedIdByKeyId }
    }, [backedUpKeyIds, keys])

    // A child-key mark dies with its key when the account is removed, so it is
    // rewritten under the seed as soon as the keystore can resolve it. This
    // runs here, not in the store's migrate, which runs before the keystore
    // has loaded. Rows race to write the same upgrade, which is idempotent.
    useEffect(() => {
        if (Object.keys(upgrades).length > 0) upgradeBackedUpKeyIds(upgrades)
    }, [upgrades, upgradeBackedUpKeyIds])

    return useCallback(
        (account: WalletAccount) => {
            if (!hasRecoverySeed(account)) return false
            const seedId = seedOf(account, keys)
            return seedId !== undefined && !backedUpSeedIds.has(seedId)
        },
        [backedUpSeedIds, keys],
    )
}
