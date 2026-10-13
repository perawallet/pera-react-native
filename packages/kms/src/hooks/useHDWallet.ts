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

import type { Key, KeyData } from '@algorandfoundation/keystore-core'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { buildSeedMetadata, entropyChildMetadata } from '../utils'
import { useKMSService } from './useKMSServices'
import { usePasskeyMainKey } from './usePasskeyMainKey'
import { prepareHDMasterKey } from '../crypto/prepare-hd-master-key'
import { commitSecret } from '../storage/secrets'
import { handOffSecret, zeroBytes } from '../crypto/secure-memory'
import { SeedScheme } from '../constants'

export type HDWalletKeyResult = {
    seedKey: Key
}

export const useHDWallet = () => {
    const { keyStore } = useKMSService()
    const { ensurePasskeyMainKey } = usePasskeyMainKey()

    const createHDWalletKey = async (params?: {
        id?: string
        /** Wordlist indices (`mnemonicWordsToIndices`) — never the phrase
         * itself, so no mnemonic string reaches the key path. */
        mnemonicIndices?: Uint16Array
    }): Promise<HDWalletKeyResult> => {
        const prepared = await prepareHDMasterKey(params)
        return persistHDMasterKey({
            keyId: prepared.keyId,
            rootKey: handOffSecret(prepared.rootKey),
            entropy: handOffSecret(prepared.entropy),
        })
    }

    const persistHDMasterKey = async (prepared: {
        keyId: string
        rootKey: Uint8Array
        entropy: Uint8Array
    }): Promise<HDWalletKeyResult> => {
        const { keyId, rootKey, entropy } = prepared

        const metadata = buildSeedMetadata({ scheme: SeedScheme.Bip39 })

        try {
            // These bytes are the 96-byte XHD extended root key, not a BIP-39
            // seed: `deriveFromSeed` injects them straight into the
            // BIP32-Ed25519 shim, and it rejects any parent not typed
            // `hd-root-key`. The mnemonic is rebuilt from the entropy child
            // below, never from these bytes.
            const rootKeyData: KeyData = {
                id: keyId,
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey: rootKey,
                metadata,
            }

            await keyStore.import(rootKeyData, 'raw')

            // Entropy lives in a separate `secret-key` child, not in the seed
            // metadata, so it never leaks through the seed's reactive snapshot
            // or `keyStore.export()`. The child is found later by its metadata
            // (`entropyChildMetadata`), not a derived id. `commitSecret` copies
            // the bytes; the originals are zeroed below.
            //
            // Transactional: a seed without its entropy child can't rebuild its
            // mnemonic, so it's unrecoverable. If the commit fails, roll back
            // the just-imported seed rather than persist that partial state.
            try {
                await commitSecret({
                    id: generateOrderedUniqueId(),
                    bytes: entropy,
                    metadata: entropyChildMetadata(keyId),
                })
            } catch (error) {
                await keyStore.remove(keyId).catch(() => {})
                throw error
            }

            // Degraded, not broken: the wallet is complete without a passkey
            // main key, and `repairs/0003-mint-passkey-main-key` back-fills it
            // on a later launch. Rolling the seed back here would destroy a
            // wallet the user can still use.
            try {
                await ensurePasskeyMainKey(keyId)
            } catch (error) {
                logger.error('ensurePasskeyMainKey failed', { error })
            }
        } finally {
            zeroBytes(rootKey, entropy)
        }

        return {
            seedKey: {
                id: keyId,
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                metadata,
            },
        }
    }

    return {
        createHDWalletKey,
        persistHDMasterKey,
    }
}
