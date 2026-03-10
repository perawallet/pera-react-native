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
import { KeyNotFoundError, useKMS } from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = getProvider().deviceInfo
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const {
        getKey,
        createHDWalletKey,
        createAlgo25Key,
        generateDerivedKey,
        withExportedKey,
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
        entropyKeyId: providedEntropyKeyId,
        account,
        keyIndex,
    }: {
        walletId?: string
        entropyKeyId?: string
        account: number
        keyIndex: number
    }) => {
        const rootWalletId = walletId ?? generateOrderedUniqueId()
        let rootKey = getKey(rootWalletId)
        let entropyKeyId = providedEntropyKeyId

        if (!rootKey) {
            const result = await createHDWalletKey({ id: rootWalletId })
            rootKey = result.keyPair
            entropyKeyId = result.entropyKeyId
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

        const newAccount = await withExportedKey(
            derivedKeystoreKeyId,
            keyData => {
                if (!keyData.publicKey) {
                    throw new NoHDWalletError(rootWalletId)
                }

                return {
                    id: generateOrderedUniqueId(),
                    address: encodeAlgorandAddress(keyData.publicKey),
                    type: AccountTypes.hdWallet,
                    hdWalletDetails: {
                        account,
                        change: 0,
                        keyIndex,
                        derivationType: BIP32DerivationType.Peikert,
                        keystoreKeyId: derivedKeystoreKeyId,
                    },
                    keyPairId: rootWalletId,
                    entropyKeyId,
                } satisfies WalletAccount
            },
        )

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createAlgo25WalletAccount = async ({
        id,
        seedKeyId: providedSeedKeyId,
    }: {
        id?: string
        seedKeyId?: string
    }) => {
        const keyId = id ?? generateOrderedUniqueId()
        let rootKey = getKey(keyId)
        let seedKeyId = providedSeedKeyId

        if (!rootKey) {
            const result = await createAlgo25Key({ id: keyId })
            rootKey = result.keyPair
            seedKeyId = result.seedKeyId
        }

        if (!rootKey?.id) {
            throw new KeyNotFoundError(keyId)
        }

        const newAccount: WalletAccount = {
            id: generateOrderedUniqueId(),
            address: rootKey.publicKey,
            type: AccountTypes.algo25,
            keyPairId: rootKey.id,
            seedKeyId,
        }

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createAlgo25WalletAccount,
    }
}
