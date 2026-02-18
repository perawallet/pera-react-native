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

import { useKeyManagerStore } from '../store'
import { KeyPair, KeyType } from '../models'
import type { HDDerivationParams } from '../models/session'
import { InvalidKeyError, KeyNotFoundError } from '../errors'
import { useAlgo25 } from './useAlgo25'
import { useHDWallet } from './useHDWallet'
import { useKMSService } from './useKMSServices'

export const useKMS = () => {
    const keys = useKeyManagerStore(state => state.keys)
    const getKey = useKeyManagerStore(state => state.getKey)
    const { withAlgo25Session, createAlgo25Key } = useAlgo25()
    const { withHDSession, createHDWalletKey } = useHDWallet()
    const { deleteKey } = useKMSService()

    const loadKey = (keyId: string): KeyPair => {
        const key = getKey(keyId)

        if (!key) {
            throw new KeyNotFoundError(keyId)
        }

        return key
    }

    const signTransactionWithKey = async (
        keyId: string,
        domain: string,
        encodedTx: Uint8Array,
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array> => {
        const key = loadKey(keyId)

        switch (key.type) {
            case KeyType.HDWalletDerivedKey:
            case KeyType.HDWalletRootKey:
                if (!derivationParams) {
                    throw new InvalidKeyError(keyId)
                }
                return withHDSession(key, domain, session =>
                    session.signTransaction(derivationParams, encodedTx),
                )
            case KeyType.Algo25Key:
                return withAlgo25Session(key, domain, session =>
                    session.signTransaction(encodedTx),
                )
            default:
                throw new InvalidKeyError(key.id ?? 'unknown')
        }
    }

    const signDataWithKey = async (
        keyId: string,
        domain: string,
        data: Uint8Array,
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array> => {
        const key = loadKey(keyId)

        switch (key.type) {
            case KeyType.HDWalletDerivedKey:
            case KeyType.HDWalletRootKey:
                if (!derivationParams) {
                    throw new InvalidKeyError(keyId)
                }
                return withHDSession(key, domain, session =>
                    session.signData(derivationParams, data),
                )
            case KeyType.Algo25Key:
                return withAlgo25Session(key, domain, session =>
                    session.signData(data),
                )
            default:
                throw new InvalidKeyError(key.id ?? 'unknown')
        }
    }

    const batchSignTransactionWithKey = async (
        keyId: string,
        domain: string,
        encodedTxs: Uint8Array[],
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array[]> => {
        const key = loadKey(keyId)

        switch (key.type) {
            case KeyType.HDWalletDerivedKey:
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

    const batchSignDataWithKey = async (
        keyId: string,
        domain: string,
        data: Uint8Array[],
        derivationParams?: HDDerivationParams,
    ): Promise<Uint8Array[]> => {
        const key = loadKey(keyId)

        switch (key.type) {
            case KeyType.HDWalletDerivedKey:
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
        loadKey,
        withAlgo25Session,
        createAlgo25Key,
        withHDSession,
        createHDWalletKey,
        signTransactionWithKey,
        batchSignTransactionWithKey,
        signDataWithKey,
        batchSignDataWithKey,
    }
}
