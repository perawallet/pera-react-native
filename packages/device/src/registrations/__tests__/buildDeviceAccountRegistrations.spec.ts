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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { buildDeviceAccountRegistrations } from '../buildDeviceAccountRegistrations'
import {
    deviceChainAdapters,
    type DeviceChainAdapter,
    type DeviceRegistrableAccount,
} from '../chain-adapter'

type TestAccount = DeviceRegistrableAccount & {
    kind: 'signing' | 'watch'
}

const FIRST_CHAIN = 'algorand' as ChainId
const SECOND_CHAIN = 'ethereum' as ChainId

const RANKS = { signing: 2, watch: 1 } as const

const adapterFor = (
    chainId: ChainId,
    prefix: string,
    registersWatch = true,
): DeviceChainAdapter => ({
    chainId,
    accountTypeOf: (account: TestAccount) =>
        account.kind === 'watch' && !registersWatch
            ? null
            : `${prefix}-${account.kind}`,
    rankOf: (account: TestAccount) => RANKS[account.kind],
})

const onFirst = (
    address: string,
    kind: TestAccount['kind'] = 'signing',
): TestAccount => ({ kind, chains: { [FIRST_CHAIN]: { address } } })

describe('buildDeviceAccountRegistrations', () => {
    beforeEach(() => {
        deviceChainAdapters.reset()
        deviceChainAdapters.register(adapterFor(FIRST_CHAIN, 'first'))
    })

    it('registers each account under the type and rank its chain gives it', () => {
        const result = buildDeviceAccountRegistrations(
            [onFirst('SIGNER'), onFirst('WATCHER', 'watch')],
            [],
        )

        expect(result).toEqual([
            {
                address: 'SIGNER',
                accountType: 'first-signing',
                rank: 2,
                receiveNotifications: true,
            },
            {
                address: 'WATCHER',
                accountType: 'first-watch',
                rank: 1,
                receiveNotifications: true,
            },
        ])
    })

    it('marks muted addresses as not receiving notifications', () => {
        const result = buildDeviceAccountRegistrations(
            [onFirst('ADDR_A'), onFirst('ADDR_B')],
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

    it('registers nothing on a chain without a device adapter', () => {
        deviceChainAdapters.reset()

        expect(buildDeviceAccountRegistrations([onFirst('A')], [])).toEqual([])
    })

    it('skips an account its chain declines to register', () => {
        deviceChainAdapters.reset()
        deviceChainAdapters.register(adapterFor(FIRST_CHAIN, 'first', false))

        expect(
            buildDeviceAccountRegistrations([onFirst('W', 'watch')], []),
        ).toEqual([])
    })

    it('registers an account once per chain with a device adapter, each in its own terms', () => {
        deviceChainAdapters.register(adapterFor(SECOND_CHAIN, 'second'))
        const account: TestAccount = {
            kind: 'signing',
            chains: {
                [FIRST_CHAIN]: { address: 'FIRST-ADDR' },
                [SECOND_CHAIN]: { address: 'second-addr' },
            },
        }

        const result = buildDeviceAccountRegistrations(
            [account],
            ['second-addr'],
        )

        expect(result).toEqual([
            {
                address: 'FIRST-ADDR',
                accountType: 'first-signing',
                rank: 2,
                receiveNotifications: true,
            },
            {
                address: 'second-addr',
                accountType: 'second-signing',
                rank: 2,
                receiveNotifications: false,
            },
        ])
    })

    it('leaves out an account with no entry on a chain with a device adapter', () => {
        const elsewhere: TestAccount = {
            kind: 'signing',
            chains: { [SECOND_CHAIN]: { address: '0xabc' } },
        }

        expect(
            buildDeviceAccountRegistrations([elsewhere, onFirst('HELD')], []),
        ).toEqual([
            {
                address: 'HELD',
                accountType: 'first-signing',
                rank: 2,
                receiveNotifications: true,
            },
        ])
    })
})
