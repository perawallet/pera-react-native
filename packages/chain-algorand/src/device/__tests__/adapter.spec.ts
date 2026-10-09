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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    buildDeviceAccountRegistrations,
    deviceChainAdapters,
} from '@perawallet/wallet-core-device'
import {
    standaloneAccount,
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import { algorandDuplicateRank } from '../../accounts/local-key-kinds'
import {
    ALGORAND_DEVICE_ACCOUNT_TYPES,
    algorandDeviceAccountType,
    algorandDeviceAdapter,
} from '../adapter'

// The v3 devices API's `account_type` values and the precedence the backend
// is told about a duplicated address under; the backend prices a quantum
// account's swaps from the type, so a drift fails swaps on chain.
const WIRE = [
    ['algo25', 3, standaloneAccount('A')],
    ['hdWallet', 4, hdAccount('A')],
    ['hardware', 5, hardwareAccount('A')],
    ['multisig', 2, multisigAccount('A', null)],
    ['watch', 1, watchAccount('A')],
    ['quantum', 6, quantumAccount('A')],
] as const

describe('algorandDeviceAdapter', () => {
    it('spells every account type the way the devices API expects', () => {
        expect(Object.values(ALGORAND_DEVICE_ACCOUNT_TYPES).sort()).toEqual(
            WIRE.map(([wire]) => wire).sort(),
        )
    })

    it.each(WIRE)('registers as %s with rank %i', (wire, rank, account) => {
        expect(algorandDeviceAdapter.accountTypeOf(account)).toBe(wire)
        expect(algorandDeviceAdapter.rankOf(account)).toBe(rank)
    })

    it('ranks every account the way the accounts store dedupes it', () => {
        for (const [, , account] of WIRE) {
            expect(algorandDeviceAdapter.rankOf(account)).toBe(
                algorandDuplicateRank(account),
            )
        }
    })

    it("reports the account's own kind when rekeyed", () => {
        expect(
            algorandDeviceAccountType(
                standaloneAccount('A', { authorityAddress: 'B' }),
            ),
        ).toBe('algo25')
    })

    describe('registration', () => {
        beforeEach(() => {
            deviceChainAdapters.reset()
            deviceChainAdapters.register(algorandDeviceAdapter)
        })

        it('registers every Algorand account, watch accounts included', () => {
            const accounts = WIRE.map(([, , account], index) => ({
                ...account,
                chains: { algorand: { address: `ADDR-${index}` } },
            }))

            expect(
                buildDeviceAccountRegistrations(accounts, ['ADDR-4']),
            ).toEqual(
                WIRE.map(([wire, rank], index) => ({
                    address: `ADDR-${index}`,
                    accountType: wire,
                    rank,
                    receiveNotifications: index !== 4,
                })),
            )
        })
    })
})
