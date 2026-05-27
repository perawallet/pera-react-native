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

import {
    useDeviceID,
    useUpdateDeviceMutation,
} from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from '../store'
import { AccountTypes, WalletAccount } from '../models'
import { logger } from '@perawallet/wallet-core-shared'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    algo25SignKeyId,
    hdDerivedKeyId,
    KeyNotFoundError,
    useKMS,
} from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type Algo25SeedReference = {
    /** Keystore id of the algo25 seed entry. */
    seedKeyId: string
    /** Encoded Algorand address derived from the seed. */
    address: string
}

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = getProvider().deviceInfo
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { getKey, createHDWalletKey, createAlgo25Key, getDerivedPublicKey } =
        useKMS()

    const saveAndUpdateAccounts = async (newAccount: WalletAccount) => {
        // We get the state fresh to avoid stale captures
        const currentAccounts = useAccountsStore.getState().accounts
        const nextAccounts = [...currentAccounts, newAccount]
        setAccounts(nextAccounts)

        if (deviceID) {
            try {
                await updateDeviceOnBackend({
                    deviceId: deviceID,
                    data: {
                        platform: deviceInfo.getDevicePlatform(),
                        accounts: nextAccounts.map(a => a.address),
                    },
                })
            } catch (e) {
                logger.warn('Failed to sync account with backend', { error: e })
            }
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

        if (!seedKeyId) {
            const result = await createHDWalletKey({ id: rootWalletId })
            seedKeyId = result.seedKey.id
        }

        if (!seedKeyId) {
            throw new NoHDWalletError(rootWalletId)
        }

        const derivationType = BIP32DerivationType.Peikert
        const publicKey = await getDerivedPublicKey(
            seedKeyId,
            account,
            keyIndex,
            derivationType,
        )

        if (!publicKey) {
            throw new NoHDWalletError(rootWalletId)
        }

        return {
            id: generateOrderedUniqueId(),
            address: encodeAlgorandAddress(publicKey),
            type: AccountTypes.hdWallet,
            hdWalletDetails: { account, change: 0, keyIndex, derivationType },
            keyPairId: hdDerivedKeyId(
                seedKeyId,
                account,
                keyIndex,
                derivationType,
            ),
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
            }
        }

        if (!resolved?.seedKeyId) {
            throw new KeyNotFoundError(id ?? '')
        }

        return {
            id: generateOrderedUniqueId(),
            address: resolved.address,
            type: AccountTypes.algo25,
            keyPairId: algo25SignKeyId(resolved.seedKeyId),
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

    const createAlgo25WalletAccount = async (params: {
        seed?: Algo25SeedReference
        id?: string
    }) => {
        const newAccount = await buildAlgo25WalletAccount(params)
        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createAlgo25WalletAccount,
        buildHdWalletAccount,
        buildAlgo25WalletAccount,
        saveAccount,
    }
}
