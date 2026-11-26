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

// What the backend is told a device follows: the tokens the user kept, sent once
// a registration has landed and again after each change.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'

// Same unmocks as device-registration-v4.spec.tsx: the registration payload
// reads the real in-memory driver's `getAppVersion`.
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

import { server, http, HttpResponse } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import {
    useAccountsStore,
    useHeldListedTokensStore,
    useKeptTokensStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    clearRegistrationQueuesForTests,
    useDeviceRegistration,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import { followedTokensHandler } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'

import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// Mirrors production's `DeviceRegistrar`.
const DeviceRegistrarHost = () => {
    useDeviceRegistration(useDeviceAccountRegistrations())
    return null
}

const MAINNET = { chainId: 'ethereum', networkId: 'mainnet' } as const
const FIRST_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const SECOND_ADDRESS = '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI_CAIP19 = `eip155:1/erc20:${DAI.toLowerCase()}`

const accountWith = (id: string, ethAddress: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        ethereum: { address: ethAddress, keyPairId: `${id}-eth-key` },
    },
    name: id,
})

type FollowedBody = {
    accounts: { address: string; chain: string; tokens: string[] }[]
}

const keep = (address: string, ...assetIds: string[]): void =>
    useKeptTokensStore
        .getState()
        .keepTokens({ address, scope: MAINNET, assetIds })

describe('Followed EVM tokens', () => {
    let puts: { deviceId: string; body: FollowedBody }[]

    const recordPuts = () =>
        followedTokensHandler({
            onRequest: (deviceId, body) =>
                puts.push({ deviceId, body: body as FollowedBody }),
        })

    const reset = (): void => {
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        useKeptTokensStore.getState().resetState()
        useHeldListedTokensStore.getState().resetState()
        clearRegistrationQueuesForTests()
    }

    beforeEach(() => {
        puts = []
        reset()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
        server.use(
            http.post('*/api/v4/devices/', () =>
                HttpResponse.json({ id: 'DEV-1' }),
            ),
            recordPuts(),
        )
    })

    // Unmounted first: resetting the accounts under a mounted registrar fires
    // one more registration that would land in the next test.
    afterEach(() => {
        cleanup()
        reset()
        useRemoteConfigStore.getState().resetState()
    })

    it('sends a kept token once the registration lands, under the device id it got', async () => {
        keep(FIRST_ADDRESS, USDC)
        useAccountsStore
            .getState()
            .setAccounts([accountWith('hd-1', FIRST_ADDRESS)])

        render(<DeviceRegistrarHost />)

        await waitFor(() => expect(puts).toHaveLength(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(puts[0]).toEqual({
            deviceId: 'DEV-1',
            body: {
                accounts: [
                    {
                        address: FIRST_ADDRESS,
                        chain: 'eip155:1',
                        tokens: [USDC_CAIP19],
                    },
                ],
            },
        })
    })

    it('sends the set again, carrying both addresses, after a second account registers', async () => {
        keep(FIRST_ADDRESS, USDC)
        keep(SECOND_ADDRESS, DAI)
        useAccountsStore
            .getState()
            .setAccounts([accountWith('hd-1', FIRST_ADDRESS)])
        render(<DeviceRegistrarHost />)
        await waitFor(() => expect(puts).toHaveLength(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(puts[0]!.body.accounts.map(a => a.address)).toEqual([
            FIRST_ADDRESS,
        ])

        useAccountsStore
            .getState()
            .setAccounts([
                accountWith('hd-1', FIRST_ADDRESS),
                accountWith('hd-2', SECOND_ADDRESS),
            ])

        await waitFor(() => expect(puts).toHaveLength(2), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(puts[1]!.body.accounts).toEqual([
            {
                address: FIRST_ADDRESS,
                chain: 'eip155:1',
                tokens: [USDC_CAIP19],
            },
            {
                address: SECOND_ADDRESS,
                chain: 'eip155:1',
                tokens: [DAI_CAIP19],
            },
        ])
    })

    it('survives a refused request and sends again on the next change', async () => {
        let attempts = 0
        server.use(
            http.put(
                '*/api/v3/evm/devices/:deviceId/followed-tokens/',
                async ({ request }) => {
                    attempts += 1
                    const body = (await request.json()) as FollowedBody
                    if (attempts === 1) {
                        return HttpResponse.json(
                            { status: 422, error: 'Unprocessable' },
                            { status: 422 },
                        )
                    }
                    puts.push({ deviceId: 'DEV-1', body })
                    return HttpResponse.json(body)
                },
            ),
        )
        keep(FIRST_ADDRESS, USDC)
        useAccountsStore
            .getState()
            .setAccounts([accountWith('hd-1', FIRST_ADDRESS)])
        render(<DeviceRegistrarHost />)
        await waitFor(() => expect(attempts).toBe(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        keep(FIRST_ADDRESS, DAI)

        await waitFor(() => expect(puts).toHaveLength(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(puts[0]!.body.accounts[0]!.tokens).toEqual(
            expect.arrayContaining([USDC_CAIP19, DAI_CAIP19]),
        )
    })
})
