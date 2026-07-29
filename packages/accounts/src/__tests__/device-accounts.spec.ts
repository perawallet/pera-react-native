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

import { describe, expect, it } from 'vitest'
import {
    buildDeviceAccountRegistrations,
    toDeviceAccountType,
} from '../device-accounts'
import { AccountTypes, type WalletAccount } from '../models'

const account = (address: string, type: WalletAccount['type']): WalletAccount =>
    ({ id: address, address, type, keyPairId: 'kp' }) as WalletAccount

describe('toDeviceAccountType', () => {
    it('maps every account type onto its wire value', () => {
        expect(Object.values(AccountTypes).map(toDeviceAccountType)).toEqual([
            'algo25',
            'hdWallet',
            'hardware',
            'multisig',
            'watch',
            'quantum',
        ])
    })
})

describe('buildDeviceAccountRegistrations', () => {
    it('reports a quantum account with the quantum wire type', () => {
        const result = buildDeviceAccountRegistrations(
            [account('QADDR', AccountTypes.quantum)],
            [],
        )

        expect(result).toEqual([
            {
                address: 'QADDR',
                accountType: 'quantum',
                receiveNotifications: true,
            },
        ])
    })

    it('reports a watched address as watch, not as a boolean flag', () => {
        const result = buildDeviceAccountRegistrations(
            [account('WADDR', AccountTypes.watch)],
            [],
        )

        expect(result[0].accountType).toBe('watch')
    })

    it('marks muted addresses as not receiving notifications', () => {
        const result = buildDeviceAccountRegistrations(
            [
                account('ADDR_A', AccountTypes.algo25),
                account('ADDR_B', AccountTypes.algo25),
            ],
            ['ADDR_B'],
        )

        expect(result.map(entry => entry.receiveNotifications)).toEqual([
            true,
            false,
        ])
    })

    it('returns an empty array for an empty account list', () => {
        expect(buildDeviceAccountRegistrations([], ['ADDR_A'])).toEqual([])
    })
})
