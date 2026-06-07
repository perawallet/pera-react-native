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
import { type WalletAccount } from '../models'
import { getProvider } from '@perawallet/wallet-extension-provider'

export const useUpdateAccount = () => {
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = getProvider().deviceInfo
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()

    return (account: WalletAccount) => {
        // Read fresh copy of accounts to avoid stale captures.
        const currentAccounts = useAccountsStore.getState().accounts
        const updated = currentAccounts.map(a =>
            a.address === account.address ? account : a,
        )
        setAccounts(updated)

        if (deviceID) {
            void updateDeviceOnBackend({
                deviceId: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: updated.map(a => a.address),
                },
            })
        }
    }
}
