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
    useSecureStorageService,
    useUpdateDeviceMutation,
} from '@perawallet/wallet-core-platform-integration'
import { useAccountsStore } from '../store'
import { useHDWallet } from './useHDWallet'
import { v7 as uuidv7 } from 'uuid'
import { withKey } from '../utils'
import { WalletAccount } from '../models'
import { BIP32DerivationTypes } from '@perawallet/wallet-core-xhdwallet'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAccountsStore(state => state.accounts)
    const { generateMasterKey, deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()

    return async ({
        walletId,
        account,
        keyIndex,
    }: {
        walletId?: string
        account: number
        keyIndex: number
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const rootKeyLocation = `rootkey-${rootWalletId}`
        const masterKey = await withKey(
            rootKeyLocation,
            secureStorage,
            async key => {
                if (!key) {
                    const masterKey = await generateMasterKey()
                    const base64Seed = masterKey.seed.toString('base64')
                    const stringifiedObj = JSON.stringify({
                        seed: base64Seed,
                        entropy: masterKey.entropy,
                    })
                    await secureStorage.setItem(
                        rootKeyLocation,
                        Buffer.from(stringifiedObj),
                    )
                    return JSON.parse(stringifiedObj)
                }

                // Try to parse as JSON first (new format)
                return JSON.parse(key.toString())
            },
        )

        if (!masterKey?.seed) {
            throw Error(`No key found for ${rootWalletId}`)
        }

        const { address, privateKey } = await deriveKey({
            seed: Buffer.from(masterKey.seed, 'base64'),
            account,
            keyIndex,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        const keyBuffer = Buffer.from(privateKey)
        await secureStorage.setItem(keyStoreLocation, keyBuffer)

        keyBuffer.fill(0)
        privateKey.fill(0)

        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: rootWalletId,
                account: account,
                change: 0,
                keyIndex: keyIndex,
                derivationType: BIP32DerivationTypes.Peikert,
            },
            privateKeyLocation: keyStoreLocation,
        }

        accounts.push(newAccount)
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
        return newAccount
    }
}
