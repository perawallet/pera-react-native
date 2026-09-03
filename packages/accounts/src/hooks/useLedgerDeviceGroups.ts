/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useMemo } from 'react'
import { useAllAccounts } from './useAllAccounts'
import type { HardwareWalletAccount } from '../models'
import { isLedgerAccount } from '../utils'

export type LedgerDeviceGroup = {
    deviceId: string
    deviceName: string
    accounts: HardwareWalletAccount[]
    firstAccount: HardwareWalletAccount
    accountCount: number
}

type UseLedgerDeviceGroupsResult = {
    ledgerDeviceGroups: LedgerDeviceGroup[]
    hasMultipleLedgerDevices: boolean
}

export const useLedgerDeviceGroups = (): UseLedgerDeviceGroupsResult => {
    const accounts = useAllAccounts()

    const ledgerDeviceGroups = useMemo(() => {
        const ledgerAccounts = accounts.filter(isLedgerAccount)

        const groupMap = new Map<string, HardwareWalletAccount[]>()
        for (const account of ledgerAccounts) {
            const deviceId = account.hardwareDetails.deviceId
            const existing = groupMap.get(deviceId) ?? []
            existing.push(account)
            groupMap.set(deviceId, existing)
        }

        return Array.from(groupMap.entries()).map(
            ([deviceId, groupAccounts]): LedgerDeviceGroup => {
                const sorted = [...groupAccounts].sort(
                    (a, b) =>
                        a.hardwareDetails.accountIndex -
                        b.hardwareDetails.accountIndex,
                )
                return {
                    deviceId,
                    deviceName: sorted[0].hardwareDetails.deviceName,
                    accounts: sorted,
                    firstAccount: sorted[0],
                    accountCount: sorted.length,
                }
            },
        )
    }, [accounts])

    return {
        ledgerDeviceGroups,
        hasMultipleLedgerDevices: ledgerDeviceGroups.length > 1,
    }
}
