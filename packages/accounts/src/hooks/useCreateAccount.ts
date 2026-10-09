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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useKMS } from '@perawallet/wallet-core-kms'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { useAccountsStore } from '../store'
import type { WalletAccount } from '../models'
import { NoHdSeedError } from '../errors'
import { buildAccount } from '../credentials'
import {
    accountsChainAdapters,
    deriveHdAccount,
    requireSingleKeyAccounts,
    type LocalKeySeed,
} from '../chain-adapter'
import {
    setPendingAccountRollback,
    clearPendingAccountRollback,
} from '../store/pendingAccountCreation'

export const useCreateAccount = (scope: ChainScope) => {
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { getKey, createHDWalletKey, removeKeyAndChildren } = useKMS()

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
        const derived = await deriveHdAccount(scope, seedKeyId, {
            account,
            keyIndex,
        })
        if (!derived.publicKey) throw new NoHdSeedError(seedKeyId)

        const { chainId } = scope
        return buildAccount({
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account, keyIndex },
            },
            chainId,
            chains: {
                [chainId]: {
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

            if (!seedKeyId) throw new NoHdSeedError(rootWalletId)

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

    /** Mints an unsaved account of one of the chain's single-key kinds. */
    const buildSingleKeyAccount = async ({
        seed,
        id,
    }: {
        seed: LocalKeySeed
        id?: string
    }): Promise<WalletAccount> => {
        const minted = await requireSingleKeyAccounts(
            accountsChainAdapters.get(scope.chainId),
        ).create({ seed, id }, scope)
        if (minted.isNewSeed) {
            setPendingAccountRollback(() =>
                removeKeyAndChildren(minted.seedKeyId),
            )
        }
        return minted.account
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

    const createSingleKeyAccount = async (params: {
        seed: LocalKeySeed
        id?: string
    }) => {
        const newAccount = await buildSingleKeyAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createHdWalletAccountForSeed,
        createSingleKeyAccount,
        buildHdWalletAccount,
        buildHdWalletAccountForSeed,
        buildSingleKeyAccount,
        saveAccount,
    }
}
