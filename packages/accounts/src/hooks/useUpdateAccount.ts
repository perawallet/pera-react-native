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
import { WalletAccount } from '../models'

export const useUpdateAccount = () => {
    const accounts = useAccountsStore(state => state.accounts)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()

    return (account: WalletAccount) => {
        const index =
            accounts.findIndex(a => a.address === account.address) ?? null
        accounts[index] = account
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
