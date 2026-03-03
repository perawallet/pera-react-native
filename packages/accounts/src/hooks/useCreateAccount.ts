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
    useDeviceInfoService,
    useNetwork,
    useUpdateDeviceMutation,
} from '@perawallet/wallet-extension-platform'
import { useAccountsStore } from '../store'
import { AccountTypes, WalletAccount } from '../models'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { KeyNotFoundError, useKMS } from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { KEY_DOMAIN } from '../constants'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { getKey, createHDWalletKey, createAlgo25Key, withHDSession } =
        useKMS()

    const saveAndUpdateAccounts = async (newAccount: WalletAccount) => {
        accounts.push(newAccount)
        setAccounts([...accounts])

        if (deviceID) {
            await updateDeviceOnBackend({
                deviceId: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }

    const createHdWalletAccount = async ({
        walletId,
        account,
        keyIndex,
    }: {
        walletId?: string
        account: number
        keyIndex: number
    }) => {
        const rootWalletId = walletId ?? generateOrderedUniqueId()
        let rootKey = getKey(rootWalletId)

        if (!rootKey) {
            rootKey = await createHDWalletKey({ id: rootWalletId })
        }

        if (!rootKey?.id) {
            throw new NoHDWalletError(rootWalletId)
        }

        const newAccount = await withHDSession(
            rootKey,
            KEY_DOMAIN,
            async session => {
                const addressBytes = await session.getPublicKey({
                    account,
                    keyIndex,
                    derivationType: BIP32DerivationType.Peikert,
                })

                const newAccount: WalletAccount = {
                    id: generateOrderedUniqueId(),
                    address: encodeAlgorandAddress(addressBytes),
                    type: AccountTypes.hdWallet,
                    hdWalletDetails: {
                        account: account,
                        change: 0,
                        keyIndex: keyIndex,
                        derivationType: BIP32DerivationType.Peikert,
                    },
                    keyPairId: rootWalletId,
                }
                return newAccount
            },
        )

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createAlgo25WalletAccount = async ({ id }: { id?: string }) => {
        const keyId = id ?? generateOrderedUniqueId()
        let rootKey = getKey(keyId)

        if (!rootKey) {
            rootKey = await createAlgo25Key({ id: keyId })
        }

        if (!rootKey?.id) {
            throw new KeyNotFoundError(keyId)
        }

        const newAccount: WalletAccount = {
            id: generateOrderedUniqueId(),
            address: rootKey.publicKey,
            type: AccountTypes.algo25,
            keyPairId: rootKey.id,
        }

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createAlgo25WalletAccount,
    }
}
