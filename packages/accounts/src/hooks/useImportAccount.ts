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

import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { BIP32DerivationTypes } from '@perawallet/wallet-core-xhdwallet'
import { WalletAccount } from '../models'
import { useAccountsStore } from '../store'
import { useHDWallet } from './useHDWallet'
import {
    useDeviceID,
    useDeviceInfoService,
    useNetwork,
    useSecureStorageService,
    useUpdateDeviceMutation,
} from '@perawallet/wallet-core-platform-integration'
import { v7 as uuidv7 } from 'uuid'

export const useImportWallet = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const { generateMasterKey, deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()

    return async ({
        walletId,
        mnemonic,
    }: {
        walletId?: string
        mnemonic: string
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const rootKeyLocation = `rootkey-${rootWalletId}`
        const masterKey = await generateMasterKey(mnemonic)
        const base64Seed = masterKey.seed.toString('base64')
        const stringifiedObj = JSON.stringify({
            seed: base64Seed,
            entropy: masterKey.entropy,
        })
        await secureStorage.setItem(
            rootKeyLocation,
            Buffer.from(stringifiedObj),
        )

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const { address, privateKey } = await deriveKey({
            seed: masterKey.seed,
            account: 0,
            keyIndex: 0,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        const keyBuffer = Buffer.from(privateKey)
        await secureStorage.setItem(keyStoreLocation, keyBuffer)
        keyBuffer.fill(0)
        privateKey.fill(0)
        const newAccount: WalletAccount = {
            id,
            address: encodeAlgorandAddress(address),
            type: 'standard',
            canSign: true,
            hdWalletDetails: {
                walletId: rootWalletId,
                account: 0,
                change: 0,
                keyIndex: 0,
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
