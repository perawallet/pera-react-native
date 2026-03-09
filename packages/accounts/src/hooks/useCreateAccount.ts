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
    useUpdateDeviceMutation,
} from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from '../store'
import { AccountTypes, WalletAccount } from '../models'
import { logger } from '@perawallet/wallet-core-shared'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { KeyNotFoundError, useKMS } from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const {
        getKey,
        createHDWalletKey,
        createAlgo25Key,
        generateDerivedKey,
        keyStore,
    } = useKMS()

    const saveAndUpdateAccounts = async (newAccount: WalletAccount) => {
        accounts.push(newAccount)
        setAccounts([...accounts])

        if (deviceID) {
            try {
                await updateDeviceOnBackend({
                    deviceId: deviceID,
                    data: {
                        platform: deviceInfo.getDevicePlatform(),
                        accounts: accounts.map(a => a.address),
                    },
                })
            } catch (e) {
                logger.warn('Failed to sync account with backend', { error: e })
            }
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

        if (!rootKey?.id || !rootKey.keystoreKeyId) {
            throw new NoHDWalletError(rootWalletId)
        }

        const derivedKeystoreKeyId = await generateDerivedKey(
            rootKey.keystoreKeyId,
            account,
            keyIndex,
            BIP32DerivationType.Peikert,
        )

        const derivedKeyData = await keyStore.export(derivedKeystoreKeyId)
        if (!derivedKeyData.publicKey) {
            throw new NoHDWalletError(rootWalletId)
        }

        const newAccount: WalletAccount = {
            id: generateOrderedUniqueId(),
            address: encodeAlgorandAddress(derivedKeyData.publicKey),
            type: AccountTypes.hdWallet,
            hdWalletDetails: {
                account,
                change: 0,
                keyIndex,
                derivationType: BIP32DerivationType.Peikert,
                keystoreKeyId: derivedKeystoreKeyId,
            },
            keyPairId: rootWalletId,
        }

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
