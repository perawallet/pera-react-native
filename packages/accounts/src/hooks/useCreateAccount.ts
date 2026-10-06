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
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import {
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { buildAccount } from '../credentials'
import {
    accountsAdapterFor,
    deriveHdAccount,
    requireSingleKeyAccounts,
    type SingleKeyAccountKind,
} from '../chain-adapter'
import {
    setPendingAccountRollback,
    clearPendingAccountRollback,
} from '../store/pendingAccountCreation'

export const useCreateAccount = () => {
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const kms = useKMS()
    const { getKey, createHDWalletKey, removeKeyAndChildren } = kms

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
    // would still be stale, but `kmsCore` reads the live store.
    const buildHdWalletAccountForSeed = async ({
        seedKeyId,
        account,
        keyIndex,
    }: {
        seedKeyId: string
        account: number
        keyIndex: number
    }): Promise<WalletAccount> => {
        const derived = await deriveHdAccount(network, seedKeyId, {
            account,
            keyIndex,
        })
        if (!derived.publicKey) throw new NoHDWalletError(seedKeyId)

        return buildAccount({
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account, keyIndex },
            },
            chains: {
                [LEGACY_CHAIN_ID]: {
                    address: derived.address,
                    keyPairId: derived.keyPairId,
                },
            },
        })
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

    const buildSingleKeyAccount = async (
        kind: SingleKeyAccountKind,
        id?: string,
    ): Promise<WalletAccount> => {
        const minted = await requireSingleKeyAccounts(
            accountsAdapterFor(network),
        ).create(kms, { kind, id }, scopeForLegacyNetwork(network))
        if (minted.isNewSeed) {
            setPendingAccountRollback(() =>
                removeKeyAndChildren(minted.seedKeyId),
            )
        }
        return minted.account
    }

    const buildAlgo25WalletAccount = ({ id }: { id?: string }) =>
        buildSingleKeyAccount(AccountTypes.algo25, id)

    const buildQuantumWalletAccount = ({ id }: { id?: string } = {}) =>
        buildSingleKeyAccount(AccountTypes.quantum, id)

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

    const createAlgo25WalletAccount = async (params: { id?: string }) => {
        const newAccount = await buildAlgo25WalletAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createQuantumWalletAccount = async (params?: { id?: string }) => {
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
