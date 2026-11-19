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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    toDeviceRegistrationRequest,
    toV3DeviceRegistrationRequest,
} from '../serializers'
import type { DeviceRegistration } from '../../models'

const FIRST_CHAIN = 'algorand' as ChainId
const SECOND_CHAIN = 'ethereum' as ChainId
const UNNAMED_CHAIN = 'base' as ChainId

const FIRST_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const SECOND_CAIP2 = 'eip155:1'

const chainOf = (chainId: ChainId): string | null =>
    ({ [FIRST_CHAIN]: FIRST_CAIP2, [SECOND_CHAIN]: SECOND_CAIP2 })[
        chainId as string
    ] ?? null

const serialize = (registration: DeviceRegistration) =>
    toDeviceRegistrationRequest(registration, chainOf)

// The chain names the kinds and ranks them; serialization only compares ranks.
const SIGNING = {
    chainId: FIRST_CHAIN,
    accountType: 'signing-kind',
    rank: 2,
} as const
const WATCH = {
    chainId: FIRST_CHAIN,
    accountType: 'watch-kind',
    rank: 1,
} as const

const baseRegistration: DeviceRegistration = {
    pushToken: 'fcm-token',
    platform: 'ios',
    locale: 'en-US',
    appVersion: '7.0.1',
    accounts: [],
    mutedChainIds: [],
}

describe('toDeviceRegistrationRequest', () => {
    it('maps the domain payload onto the wire shape', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request).toEqual({
            push_token: 'fcm-token',
            platform: 'ios',
            locale: 'en-US',
            app_version: '7.0.1',
            accounts: [
                {
                    address: 'ADDR_A',
                    chain: FIRST_CAIP2,
                    account_type: 'signing-kind',
                    receive_notifications: true,
                },
            ],
            muted_chains: [],
        })
    })

    it('sends the display currency the user picked', () => {
        const request = serialize({
            ...baseRegistration,
            currency: 'TRY',
        })

        expect(request.currency).toBe('TRY')
    })

    it('omits currency when the registration carries none', () => {
        const request = serialize(baseRegistration)

        expect('currency' in request).toBe(false)
    })

    it('omits an over-long currency rather than truncating it', () => {
        const request = serialize({
            ...baseRegistration,
            currency: 'TOOLONGCURRENCY',
        })

        expect('currency' in request).toBe(false)
    })

    it('omits id when the registration has none', () => {
        const request = serialize(baseRegistration)

        expect('id' in request).toBe(false)
    })

    it('includes id when the registration carries one', () => {
        const request = serialize({
            ...baseRegistration,
            id: '3502762836822418987',
        })

        expect(request.id).toBe('3502762836822418987')
    })

    it('never emits the v1-only model, application or is_watch_account fields', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: false,
                },
            ],
        })

        expect(Object.keys(request).sort()).toEqual([
            'accounts',
            'app_version',
            'locale',
            'muted_chains',
            'platform',
            'push_token',
        ])
        // `rank` decides deduplication locally and never reaches the wire.
        expect(Object.keys(request.accounts[0]).sort()).toEqual([
            'account_type',
            'address',
            'chain',
            'receive_notifications',
        ])
    })

    it('deduplicates repeated addresses, the higher-ranked registration winning', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: false,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                chain: FIRST_CAIP2,
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('registers a duplicated address under the higher rank when the watch entry comes first', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                chain: FIRST_CAIP2,
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('registers a duplicated address under the higher rank when the watch entry comes last', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...WATCH,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                chain: FIRST_CAIP2,
                account_type: 'signing-kind',
                receive_notifications: true,
            },
        ])
    })

    it('keeps the last entry when two duplicates rank equally', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: true,
                },
                {
                    address: 'ADDR_A',
                    ...SIGNING,
                    receiveNotifications: false,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'ADDR_A',
                chain: FIRST_CAIP2,
                account_type: 'signing-kind',
                receive_notifications: false,
            },
        ])
    })

    it('emits an empty accounts array rather than omitting the field', () => {
        const request = serialize(baseRegistration)

        expect(request.accounts).toEqual([])
    })

    it('names each account by the chain the deployment serves it on', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                { address: 'ADDR_A', ...SIGNING, receiveNotifications: true },
                {
                    address: '0xabc',
                    ...SIGNING,
                    chainId: SECOND_CHAIN,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts.map(account => account.chain)).toEqual([
            FIRST_CAIP2,
            SECOND_CAIP2,
        ])
    })

    it('keeps one address registered on two chains as two items', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                { address: 'SHARED', ...SIGNING, receiveNotifications: true },
                {
                    address: 'SHARED',
                    ...WATCH,
                    chainId: SECOND_CHAIN,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts).toEqual([
            {
                address: 'SHARED',
                chain: FIRST_CAIP2,
                account_type: 'signing-kind',
                receive_notifications: true,
            },
            {
                address: 'SHARED',
                chain: SECOND_CAIP2,
                account_type: 'watch-kind',
                receive_notifications: true,
            },
        ])
    })

    it('leaves out an account on a chain the deployment cannot name', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [
                { address: 'ADDR_A', ...SIGNING, receiveNotifications: true },
                {
                    address: '0xdef',
                    ...SIGNING,
                    chainId: UNNAMED_CHAIN,
                    receiveNotifications: true,
                },
            ],
        })

        expect(request.accounts.map(account => account.address)).toEqual([
            'ADDR_A',
        ])
    })
})

describe('muted chains', () => {
    const onBoth = [
        { address: 'ADDR_A', ...SIGNING, receiveNotifications: true },
        {
            address: '0xabc',
            ...SIGNING,
            chainId: SECOND_CHAIN,
            receiveNotifications: true,
        },
    ]

    it('sends a muted chain with an account on it as its CAIP-2 id', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: onBoth,
            mutedChainIds: [SECOND_CHAIN],
        })

        expect(request.muted_chains).toEqual([SECOND_CAIP2])
    })

    it('names the chain on the deployment the request goes to', () => {
        const request = toDeviceRegistrationRequest(
            {
                ...baseRegistration,
                accounts: onBoth,
                mutedChainIds: [SECOND_CHAIN],
            },
            chainId => (chainId === SECOND_CHAIN ? 'eip155:11155111' : null),
        )

        expect(request.muted_chains).toEqual(['eip155:11155111'])
    })

    it('leaves out a muted chain no account is on', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: [onBoth[0]],
            mutedChainIds: [SECOND_CHAIN],
        })

        expect(request.muted_chains).toEqual([])
    })

    it('leaves out a muted chain the deployment cannot name', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: onBoth,
            mutedChainIds: [UNNAMED_CHAIN],
        })

        expect(request.muted_chains).toEqual([])
    })

    it('collapses a chain muted twice', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: onBoth,
            mutedChainIds: [SECOND_CHAIN, SECOND_CHAIN],
        })

        expect(request.muted_chains).toEqual([SECOND_CAIP2])
    })

    it('does not change what each account receives', () => {
        const request = serialize({
            ...baseRegistration,
            accounts: onBoth,
            mutedChainIds: [SECOND_CHAIN],
        })

        expect(
            request.accounts.map(account => account.receive_notifications),
        ).toEqual([true, true])
    })

    it('is absent from the v3 request', () => {
        const request = toV3DeviceRegistrationRequest(
            {
                ...baseRegistration,
                accounts: onBoth,
                mutedChainIds: [FIRST_CHAIN],
            },
            () => true,
        )

        expect('muted_chains' in request).toBe(false)
    })
})
