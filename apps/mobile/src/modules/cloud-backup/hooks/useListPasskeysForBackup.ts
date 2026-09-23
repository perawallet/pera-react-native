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
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    type BackupPasskey,
    useProvenPasskeysStore,
} from '@perawallet/wallet-core-backup'
import {
    entropyChildIdOf,
    useKMS,
    withSecret,
} from '@perawallet/wallet-core-kms'
import { passkeyBackupInputs } from '@perawallet/wallet-core-passkeys'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'

/** Resolves a seed key id's entropy directly — unlike `SeedEntropyResolver`
 *  (Task 14, keyed by seed address for the restore path), `passkeyBackupInputs`
 *  already knows the owning seed's key id from the credential's own metadata. */
const resolveEntropyByKeyId = async (
    seedKeyId: string,
): Promise<Uint8Array | null> => {
    const keys = getKeystoreStore().state.keys
    const entropyId = entropyChildIdOf(seedKeyId, keys)
    if (!entropyId) return null
    // `withSecret` zeroes its buffer once the handler returns, so the handler
    // copies the bytes out rather than handing back the reference itself.
    return withSecret(entropyId, entropy => new Uint8Array(entropy))
}

export const useListPasskeysForBackup = (): (() => Promise<
    BackupPasskey[]
>) => {
    const { getDerivedPublicKey } = useKMS()
    const setProvenPasskeys = useProvenPasskeysStore(
        state => state.setProvenPasskeys,
    )

    return useCallback(async () => {
        const keys = getKeystoreStore().state.keys

        const inputs = await Promise.all(
            keys.map(key => passkeyBackupInputs(key, resolveEntropyByKeyId)),
        )

        const passkeys: BackupPasskey[] = []
        for (const input of inputs) {
            if (input === null) continue
            const { seedKeyId, ...rest } = input
            // First-derived (acc0/idx0/Peikert) address, the same dedup key
            // `useResolveHdSeedForBackup` derives, joining to the seed's own
            // `secrets/` backup item.
            const firstDerived = await getDerivedPublicKey(
                seedKeyId,
                0,
                0,
                BIP32DerivationType.Peikert,
            )
            passkeys.push({
                ...rest,
                seedAddress: encodeAlgorandAddress(firstDerived),
            })
        }

        // Proving a credential is a PBKDF2 per owning seed, so this result is
        // cached for the review screens and overview counts to read
        // synchronously instead of re-deriving on a render path.
        setProvenPasskeys(passkeys)
        return passkeys
    }, [getDerivedPublicKey, setProvenPasskeys])
}
