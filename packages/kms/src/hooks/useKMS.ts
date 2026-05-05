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

import { useCallback, useMemo } from 'react'
import { KeyPair, KeyType } from '../models'
import type { HDDerivationParams } from '../models/session'
import { InvalidKeyError, KeyNotFoundError } from '../errors'
import { zeroBytes } from '../crypto/secure-memory'
import { keystoreKeyToKeyPair } from '../utils'
import { useAlgo25 } from './useAlgo25'
export type { Algo25KeyResult } from './useAlgo25'
import { useHDWallet } from './useHDWallet'
export type { HDWalletKeyResult } from './useHDWallet'
import { useKMSService } from './useKMSServices'
import { useKeystoreKeys } from './useKeystoreState'

export type ExecuteWithMnemonicHandler<T> = (words: string[]) => T | Promise<T>

export const useKMS = () => {
    const keystoreKeys = useKeystoreKeys()
    const { withAlgo25Session, createAlgo25Key } = useAlgo25()
    const { withHDSession, createHDWalletKey, persistHDMasterKey, generateDerivedKey } =
        useHDWallet()
    const { deleteKey, keyStore, withExportedKey } = useKMSService()

    // Wallet-domain view of the keystore: only wallet-root keys (HD roots,
    // Algo25 roots, P256 roots), with `acl`/`createdAt`/`expiresAt` decoded
    // out of `Key.metadata.pera`. HD-derived children, entropy, and seed
    // entries are filtered by the adapter.
    const keys = useMemo(() => {
        const out = new Map<string, KeyPair>()
        for (const k of keystoreKeys) {
            const kp = keystoreKeyToKeyPair(k)
            if (kp?.id) out.set(kp.id, kp)
        }
        return out
    }, [keystoreKeys])

    const getKey = useCallback(
        (keyId: string): KeyPair | null => {
            const kp = keys.get(keyId)
            if (!kp) return null
            if (kp.expiresAt && Date.now() > kp.expiresAt.getTime()) {
                void keyStore.remove(keyId)
                return null
            }
            return kp
        },
        [keys, keyStore],
    )

    const getKeyOrThrow = useCallback(
        (keyId: string): KeyPair => {
            const key = getKey(keyId)
            if (!key) {
                throw new KeyNotFoundError(keyId)
            }
            return key
        },
        [getKey],
    )

    const signTransactionsWithKey = async (
        keyId: string,
        domain: string,
        encodedTxs: Uint8Array[],
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array[]> => {
        const key = getKeyOrThrow(keyId)

        switch (key.type) {
            case KeyType.HDWalletRootKey:
                if (!derivationParams) {
                    throw new InvalidKeyError(keyId)
                }
                return withHDSession(key, domain, session =>
                    Promise.all(
                        encodedTxs.map(async tx =>
                            session.signTransaction(derivationParams, tx),
                        ),
                    ),
                )
            case KeyType.Algo25Key:
                return withAlgo25Session(key, domain, session =>
                    Promise.all(
                        encodedTxs.map(async tx => session.signTransaction(tx)),
                    ),
                )
            default:
                throw new InvalidKeyError(key.id ?? 'unknown')
        }
    }

    // Runs `handler` with the mnemonic words decoded from the session, then
    // zeroes the underlying bytes before returning. Callers never see the raw
    // Uint8Array — only the word array, which is local to the handler call.
    const executeWithMnemonic = async <T>(
        keyId: string,
        domain: string,
        handler: ExecuteWithMnemonicHandler<T>,
    ): Promise<T> => {
        const key = getKeyOrThrow(keyId)

        const run = async (session: {
            getMnemonic: () => Promise<Uint8Array>
        }): Promise<T> => {
            let bytes: Uint8Array | null = null
            try {
                bytes = await session.getMnemonic()
                const words = new TextDecoder().decode(bytes).split(' ')
                return await handler(words)
            } finally {
                zeroBytes(bytes)
            }
        }

        switch (key.type) {
            case KeyType.HDWalletRootKey:
                return withHDSession(key, domain, run)
            case KeyType.Algo25Key:
                return withAlgo25Session(key, domain, run)
            default:
                throw new InvalidKeyError(key.id ?? 'unknown')
        }
    }

    const signDataWithKey = async (
        keyId: string,
        domain: string,
        data: Uint8Array[],
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array[]> => {
        const key = getKeyOrThrow(keyId)

        switch (key.type) {
            case KeyType.HDWalletRootKey:
                if (!derivationParams) {
                    throw new InvalidKeyError(keyId)
                }
                return withHDSession(key, domain, session =>
                    Promise.all(
                        data.map(async d =>
                            session.signData(derivationParams, d),
                        ),
                    ),
                )
            case KeyType.Algo25Key:
                return withAlgo25Session(key, domain, session =>
                    Promise.all(data.map(async d => session.signData(d))),
                )
            default:
                throw new InvalidKeyError(key.id ?? 'unknown')
        }
    }

    return {
        keys,
        deleteKey,
        getKey,
        getKeyOrThrow,
        withAlgo25Session,
        createAlgo25Key,
        withHDSession,
        createHDWalletKey,
        persistHDMasterKey,
        generateDerivedKey,
        keyStore,
        withExportedKey,
        signTransactionsWithKey,
        signDataWithKey,
        executeWithMnemonic,
    }
}
