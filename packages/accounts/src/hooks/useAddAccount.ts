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
import { BIP32DerivationTypes } from '@perawallet/wallet-core-xhdwallet'
import { WalletAccount } from '../models'
import { KeyType, useKMD, useWithKey } from '@perawallet/wallet-core-kmd'
import { NoHDWalletError } from '../errors'

export const useAddAccount = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { deriveKey } = useHDWallet()
    const { saveKey } = useKMD()
    const { executeWithKey } = useWithKey()

    return async (account: WalletAccount) => {
        if (account.type === 'standard' && account.hdWalletDetails) {
            const rootWalletId = account.hdWalletDetails.walletId
            const masterKey = await executeWithKey(
                rootWalletId,
                'accounts',
                async data => {
                    return JSON.parse(data.toString())
                },
            )

            if (!masterKey?.seed) {
                throw new NoHDWalletError(rootWalletId)
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

            const keyPair = {
                id,
                publicKey: encodeAlgorandAddress(address),
                privateDataStorageKey: id,
                createdAt: new Date(),
                type: KeyType.HDWalletDerivedKey,
            }

            await saveKey(keyPair, privateKey)
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
