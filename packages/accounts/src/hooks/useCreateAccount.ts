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
import { v7 as uuidv7 } from 'uuid'
import { AccountTypes, WalletAccount, ImportAccountType } from '../models'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    useWithKey,
    useKMS,
    KeyType,
    KeyPair,
} from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { KEY_DOMAIN } from '../constants'

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAccountsStore(state => state.accounts)
    const { generateMasterKey, deriveAccountAddress } = useHDWallet()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { executeWithKey } = useWithKey()
    const { saveKey, getKey } = useKMS()

    return async ({
        walletId,
        account,
        keyIndex,
        type = 'universal',
    }: {
        walletId?: string
        account: number
        keyIndex: number
        type?: ImportAccountType
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        //TODO dry this code - maybe create a useHDWalletKey hook and share with useImportAccount
        let rootKey = getKey(rootWalletId)

        if (!rootKey) {
            const masterKey = await generateMasterKey()
            const keyData = {
                seed: masterKey.seed.toString('base64'),
                entropy: masterKey.entropy,
            }
            const stringifiedObj = JSON.stringify(keyData)
            rootKey = {
                id: rootWalletId,
                publicKey: '',
                privateDataStorageKey: '',
                domain: KEY_DOMAIN,
                createdAt: new Date(),
                type:
                    type === 'universal'
                        ? KeyType.HDWalletRootKey
                        : KeyType.Algo25Key,
            } as KeyPair

            rootKey = await saveKey(
                rootKey,
                new TextEncoder().encode(stringifiedObj),
            )
            masterKey.seed.fill(0)
        }

        if (rootKey && rootKey.type === KeyType.Algo25Key) {
            const newAccount: WalletAccount = {
                id: uuidv7(),
                address: rootKey.publicKey,
                type: AccountTypes.algo25,
                canSign: true,
                keyPairId: rootKey.id,
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

        if (!rootKey?.id) {
            throw new NoHDWalletError(rootWalletId)
        }

        return executeWithKey(rootKey.id, KEY_DOMAIN, async data => {
            const masterKeyData = JSON.parse(new TextDecoder().decode(data))
            if (!masterKeyData?.seed) {
                throw new NoHDWalletError(rootWalletId)
            }

            const { address } = await deriveAccountAddress({
                seed: Buffer.from(masterKeyData.seed, 'base64'),
                account,
                keyIndex,
                derivationType: BIP32DerivationType.Peikert,
            })

            const newAccount: WalletAccount = {
                id: uuidv7(),
                address: encodeAlgorandAddress(address),
                type: AccountTypes.hdWallet,
                canSign: true,
                hdWalletDetails: {
                    walletId: rootWalletId,
                    account: account,
                    change: 0,
                    keyIndex: keyIndex,
                    derivationType: BIP32DerivationType.Peikert,
                },
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
        })
    }
}
