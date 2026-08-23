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

import { useAccountsStore } from '../store'
import { AccountTypes, type WalletAccount } from '../models'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    algo25SignKeyId,
    hdDerivedKeyId,
    KeyNotFoundError,
    PQ_DERIVATION_CANONICAL,
    quantumSignKeyId,
    useKMS,
} from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    setPendingAccountRollback,
    clearPendingAccountRollback,
} from '../store/pendingAccountCreation'

export type Algo25SeedReference = {
    /** Keystore id of the algo25 seed entry. */
    seedKeyId: string
    /** Encoded Algorand address derived from the seed. */
    address: string
}

export type QuantumSeedReference = {
    /** Keystore id of the quantum seed entry. */
    seedKeyId: string
    /** Encoded Algorand address derived from the seed. */
    address: string
}

export const useCreateAccount = () => {
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const {
        getKey,
        createHDWalletKey,
        createAlgo25Key,
        createQuantumKey,
        getDerivedPublicKey,
        removeKeyAndChildren,
    } = useKMS()

    const saveAndUpdateAccounts = async (newAccount: WalletAccount) => {
        // We get the state fresh to avoid stale captures
        const currentAccounts = useAccountsStore.getState().accounts
        const nextAccounts = [...currentAccounts, newAccount]
        setAccounts(nextAccounts)
        clearPendingAccountRollback()
    }

    // Pure derivation primitive: given a seed that's already in the keystore,
    // derive the child at (account, keyIndex) and build the WalletAccount.
    // Skips `getKey()` so it's safe to call right after `createHDWalletKey`
    // in the same React tick — the keystore snapshot from `useKeystoreKeys`
    // would still be stale, but `getDerivedPublicKey` reads the live store.
    const buildHdWalletAccountForSeed = async ({
        seedKeyId,
        account,
        keyIndex,
    }: {
        seedKeyId: string
        account: number
        keyIndex: number
    }): Promise<WalletAccount> => {
        const derivationType = BIP32DerivationType.Peikert
        const publicKey = await getDerivedPublicKey(
            seedKeyId,
            account,
            keyIndex,
            derivationType,
        )
        if (!publicKey) throw new NoHDWalletError(seedKeyId)

        return {
            id: generateOrderedUniqueId(),
            address: encodeAlgorandAddress(publicKey),
            type: AccountTypes.hdWallet,
            hdWalletDetails: {
                account,
                change: 0,
                keyIndex,
                derivationType,
            },
            keyPairId: hdDerivedKeyId(
                seedKeyId,
                account,
                keyIndex,
                derivationType,
            ),
        }
    }

    const buildHdWalletAccount = async ({
        walletId,
        account,
        keyIndex,
    }: {
        walletId?: string
        account: number
        keyIndex: number
    }): Promise<WalletAccount> => {
        const rootWalletId = walletId ?? generateOrderedUniqueId()
        let seedKeyId: string | undefined = getKey(rootWalletId)?.id
        let createdNewSeed = false

        try {
            if (!seedKeyId) {
                const result = await createHDWalletKey({ id: rootWalletId })
                seedKeyId = result.seedKey.id
                createdNewSeed = true
            }

            if (!seedKeyId) throw new NoHDWalletError(rootWalletId)

            const newAccount = await buildHdWalletAccountForSeed({
                seedKeyId,
                account,
                keyIndex,
            })

            if (createdNewSeed) {
                setPendingAccountRollback(() =>
                    removeKeyAndChildren(rootWalletId),
                )
            }

            return newAccount
        } catch (error) {
            if (createdNewSeed) {
                await removeKeyAndChildren(rootWalletId).catch(() => {})
            }
            throw error
        }
    }

    const buildAlgo25WalletAccount = async ({
        seed,
        id,
    }: {
        seed?: Algo25SeedReference
        id?: string
    }): Promise<WalletAccount> => {
        let resolved: Algo25SeedReference | null = seed ?? null
        let createdNewKey = false
        let createdKeyId: string | undefined

        try {
            if (!resolved) {
                const keyId = id ?? generateOrderedUniqueId()
                const existing = getKey(keyId)
                if (existing) {
                    resolved = {
                        seedKeyId: existing.id,
                        address: encodeAlgorandAddress(
                            existing.publicKey ?? new Uint8Array(),
                        ),
                    }
                } else {
                    const result = await createAlgo25Key({ id: keyId })
                    resolved = {
                        seedKeyId: result.seedKey.id,
                        address: result.address,
                    }
                    createdNewKey = true
                    createdKeyId = result.seedKey.id
                }
            }

            if (!resolved?.seedKeyId) throw new KeyNotFoundError(id ?? '')

            const newAccount: WalletAccount = {
                id: generateOrderedUniqueId(),
                address: resolved.address,
                type: AccountTypes.algo25,
                keyPairId: algo25SignKeyId(resolved.seedKeyId),
            }

            if (createdNewKey && createdKeyId) {
                const keyToRemove = createdKeyId
                setPendingAccountRollback(() =>
                    removeKeyAndChildren(keyToRemove),
                )
            }

            return newAccount
        } catch (error) {
            if (createdNewKey && createdKeyId) {
                await removeKeyAndChildren(createdKeyId).catch(() => {})
            }
            throw error
        }
    }

    // Unlike buildAlgo25WalletAccount there is no getKey(id) reuse branch:
    // a quantum seed entry carries no derivable public key at this layer
    // (the signing child holds it, inside the KMS), so a bare `id` is
    // passed through to createQuantumKey instead.
    const buildQuantumWalletAccount = async ({
        seed,
        id,
    }: {
        seed?: QuantumSeedReference
        id?: string
    } = {}): Promise<WalletAccount> => {
        if (seed) {
            return {
                id: generateOrderedUniqueId(),
                address: seed.address,
                type: AccountTypes.quantum,
                keyPairId: quantumSignKeyId(
                    seed.seedKeyId,
                    PQ_DERIVATION_CANONICAL,
                ),
            }
        }

        const result = await createQuantumKey({ id })
        const createdKeyId = result.seedKey.id
        try {
            const newAccount: WalletAccount = {
                id: generateOrderedUniqueId(),
                address: result.address,
                type: AccountTypes.quantum,
                keyPairId: result.signKeyId,
            }

            setPendingAccountRollback(() => removeKeyAndChildren(createdKeyId))

            return newAccount
        } catch (error) {
            await removeKeyAndChildren(createdKeyId).catch(() => {})
            throw error
        }
    }

    const saveAccount = async (account: WalletAccount) => {
        await saveAndUpdateAccounts(account)
    }

    const createHdWalletAccount = async (params: {
        walletId?: string
        account: number
        keyIndex: number
    }) => {
        const newAccount = await buildHdWalletAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createHdWalletAccountForSeed = async (params: {
        seedKeyId: string
        account: number
        keyIndex: number
    }) => {
        const newAccount = await buildHdWalletAccountForSeed(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createAlgo25WalletAccount = async (params: {
        seed?: Algo25SeedReference
        id?: string
    }) => {
        const newAccount = await buildAlgo25WalletAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createQuantumWalletAccount = async (params?: {
        seed?: QuantumSeedReference
        id?: string
    }) => {
        const newAccount = await buildQuantumWalletAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createHdWalletAccountForSeed,
        createAlgo25WalletAccount,
        createQuantumWalletAccount,
        buildHdWalletAccount,
        buildHdWalletAccountForSeed,
        buildAlgo25WalletAccount,
        buildQuantumWalletAccount,
        saveAccount,
    }
}
