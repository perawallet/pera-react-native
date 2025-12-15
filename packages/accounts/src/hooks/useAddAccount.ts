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
} from '@perawallet/wallet-core-platform-integration'
import { useAccountsStore } from '../store'
import { useHDWallet } from './useHDWallet'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { v7 as uuidv7 } from 'uuid'
import { withKey } from '../utils'
import { BIP32DerivationTypes } from '@perawallet/wallet-core-xhdwallet'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { WalletAccount } from '../models'
import { AccountKeyNotFoundError, InvalidMasterKeyError } from '../errors'

export const useAddAccount = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { deriveKey } = useHDWallet()

    return async (account: WalletAccount) => {
        if (account.type === 'standard' && account.hdWalletDetails) {
            const rootWalletId = account.hdWalletDetails.walletId
            const rootKeyLocation = `rootkey-${rootWalletId}`
            const masterKey = await withKey(
                rootKeyLocation,
                secureStorage,
                async key => {
                    if (!key) {
                        throw new AccountKeyNotFoundError(rootWalletId)
                    }

                    return JSON.parse(key.toString())
                },
            )

            if (!masterKey?.seed) {
                throw new InvalidMasterKeyError(rootWalletId)
            }
            const { address, privateKey } = await deriveKey({
                seed: Buffer.from(masterKey.seed, 'base64'),
                account: account.hdWalletDetails!.account,
                keyIndex: account.hdWalletDetails!.keyIndex,
                derivationType: BIP32DerivationTypes.Peikert,
            })
            const id = uuidv7()
            account.address = encodeAlgorandAddress(address)
            account.id = id

            const keyStoreLocation = `pk-${id}`
            const keyBuffer = Buffer.from(privateKey)
            await secureStorage.setItem(keyStoreLocation, keyBuffer)
            keyBuffer.fill(0)
            privateKey.fill(0)
        }

        accounts.push(account)
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                deviceId: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}
