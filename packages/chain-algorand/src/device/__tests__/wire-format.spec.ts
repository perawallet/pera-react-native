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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
// The device package's golden, so both sides pin the same wire values; it
// ships no testing entry.
import { GOLDEN_DEVICE_ACCOUNT_TYPES } from '../../../../device/src/hooks/__tests__/deviceWireFormat.golden'
import {
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    standaloneAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import {
    ALGORAND_DEVICE_ACCOUNT_TYPES,
    algorandDeviceAdapter,
} from '../adapter'

const ACCOUNT_FOR_GOLDEN: Record<
    keyof typeof GOLDEN_DEVICE_ACCOUNT_TYPES,
    WalletAccount
> = {
    algo25: standaloneAccount('A'),
    hdWallet: hdAccount('A'),
    hardware: hardwareAccount('A'),
    multisig: multisigAccount('A', null),
    watch: watchAccount('A'),
    quantum: quantumAccount('A'),
}

// The device package pins how a registration carries these values; this pins
// the adapter that produces them.
describe('algorandDeviceAdapter wire format', () => {
    it('spells exactly the golden account types', () => {
        expect(Object.values(ALGORAND_DEVICE_ACCOUNT_TYPES).sort()).toEqual(
            Object.values(GOLDEN_DEVICE_ACCOUNT_TYPES).sort(),
        )
    })

    it.each(Object.entries(GOLDEN_DEVICE_ACCOUNT_TYPES))(
        'registers the %s account as its golden type',
        (kind, wire) => {
            const account =
                ACCOUNT_FOR_GOLDEN[
                    kind as keyof typeof GOLDEN_DEVICE_ACCOUNT_TYPES
                ]

            expect(algorandDeviceAdapter.accountTypeOf(account)).toBe(wire)
        },
    )
})
