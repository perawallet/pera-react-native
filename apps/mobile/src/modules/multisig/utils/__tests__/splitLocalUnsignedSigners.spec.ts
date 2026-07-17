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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { splitLocalUnsignedSigners } from '../splitLocalUnsignedSigners'

const algo25 = (address: string): WalletAccount => ({
    id: `algo25-${address}`,
    type: AccountTypes.algo25,
    address,
    keyPairId: `kp-${address}`,
})

const hardware = (address: string): WalletAccount => ({
    id: `hardware-${address}`,
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
})

describe('splitLocalUnsignedSigners', () => {
    it('returns empty groups when given an empty list', () => {
        expect(splitLocalUnsignedSigners([])).toEqual({
            localKey: [],
            hardware: new Set(),
        })
    })

    it('places local-key accounts in localKey and hardware accounts in hardware (by address)', () => {
        const result = splitLocalUnsignedSigners([
            algo25('A'),
            hardware('L1'),
            algo25('B'),
            hardware('L2'),
        ])

        expect(result.localKey.map(a => a.address)).toEqual(['A', 'B'])
        expect(result.hardware).toEqual(new Set(['L1', 'L2']))
    })

    it('preserves the input order within localKey', () => {
        const result = splitLocalUnsignedSigners([
            algo25('B'),
            algo25('A'),
            algo25('C'),
        ])

        expect(result.localKey.map(a => a.address)).toEqual(['B', 'A', 'C'])
    })

    it('returns only-hardware result when no local-key accounts are present', () => {
        const result = splitLocalUnsignedSigners([hardware('L')])

        expect(result.localKey).toEqual([])
        expect(result.hardware).toEqual(new Set(['L']))
    })
})
