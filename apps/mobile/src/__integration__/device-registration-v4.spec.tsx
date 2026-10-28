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

// Device registration as the backend receives it: one item per address and
// chain, so the swap backend can price a quantum account's fee from its
// `account_type`, and EVM-keyed services see the wallet's EVM addresses.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

// The default driver mock in vitest.setup.ts predates the current payload (its
// `deviceInfo` stub exposes `getVersion`, not `getAppVersion`) — mirrors
// migration-inbox.spec.tsx. Unmocking routes `getProvider()` (already real
// for every integration test, see vitest.integration-setup.ts) through the
// real in-memory driver at test-utils/platform-driver-test.ts, whose
// `deviceInfo.getAppVersion()` is what `useDevice`'s registration payload
// actually calls.
vi.unmock('@perawallet/wallet-extension-platform-driver')
// The contract is unmocked too so the real driver runs against its genuine
// exports rather than the vitest.setup.ts stubs — same pairing
// migration-inbox.spec.tsx uses.
vi.unmock('@perawallet/wallet-extension-platform')

// The integration setup registers whichever chains config enables.
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
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    clearRegistrationQueuesForTests,
    useDeviceRegistration,
    useDeviceStore,
    type DeviceRegistrationRequest,
} from '@perawallet/wallet-core-device'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'
import { i18n } from '@i18n/index'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'
import { addressOf } from './__fixtures__/accounts'

// Mirrors production's `DeviceRegistrar` in RootComponent.tsx: join the
// accounts store + notification preferences into the registration payload
// and drive `useDeviceRegistration`. No migration gating here — this suite
// isn't exercising the migration flow (see migration-inbox.spec.tsx for
// that), so the harness skips straight to the registrar.
const DeviceRegistrarHost = () => {
    const registrations = useDeviceAccountRegistrations()
    useDeviceRegistration(registrations)
    return null
}

const renderApp = () => render(<DeviceRegistrarHost />)

const seedAccounts = (accounts: WalletAccount[]): void => {
    useAccountsStore.getState().setAccounts(accounts)
}

const addAccount = (account: WalletAccount): void => {
    const current = useAccountsStore.getState().accounts
    useAccountsStore.getState().setAccounts([...current, account])
}

// Notification preferences are persisted via a Zustand store inside
// `@perawallet/wallet-core-messages`; the store itself isn't re-exported
// from the package's public entry (mirrors account-management.spec.tsx), so
// drive resets through the hook.
const resetNotificationPreferences = (): void => {
    const { result } = renderHook(() => useNotificationPreferences())
    result.current.disabledAccounts.forEach(addr => {
        result.current.setAccountEnabled(addr, true)
    })
}

const quantumAccount: WalletAccount = {
    id: 'quantum-1',
    custody: { kind: 'local', seed: 'quantum' },
    chains: {
        algorand: { address: QUANTUM_TEST_ADDRESS, keyPairId: 'quantum-1-key' },
    },
    name: 'Quantum account',
}

const watchedAccount: WalletAccount = {
    id: 'watch-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: HD_TEST_ADDRESS } },
    name: 'Watched account',
}

const algo25Account: WalletAccount = {
    id: 'algo25-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo25-1-key' },
    },
    name: 'Algo25 account',
}

const ALGORAND_MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

const hdAccountWithEthereum: WalletAccount = {
    id: 'hd-1',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        algorand: { address: HD_TEST_ADDRESS, keyPairId: 'hd-1-key' },
        ethereum: { address: ETH_ADDRESS, keyPairId: 'hd-1-eth-key' },
    },
    name: 'HD account',
}

describe('Device registration', () => {
    beforeEach(async () => {
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        clearRegistrationQueuesForTests()
        resetNotificationPreferences()
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
    })

    // Unmount first: resetting the accounts store under a mounted registrar
    // fires one more registration, with no accounts, that lands in the next
    // test's handler and can be the body it asserts on.
    afterEach(async () => {
        cleanup()
        await i18n.changeLanguage('en')
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        clearRegistrationQueuesForTests()
        resetNotificationPreferences()
        useCurrenciesStore.getState().resetState()
        useRemoteConfigStore.getState().resetState()
    })

    it('registers a quantum account with account_type quantum', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([quantumAccount, watchedAccount])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        const latest = bodies[bodies.length - 1]

        expect(latest.accounts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    address: addressOf(quantumAccount),
                    chain: ALGORAND_MAINNET,
                    account_type: 'quantum',
                    receive_notifications: true,
                }),
                expect.objectContaining({
                    address: addressOf(watchedAccount),
                    chain: ALGORAND_MAINNET,
                    account_type: 'watch',
                }),
            ]),
        )
    })

    it('registers an Algorand-only wallet as one item per account, all on Algorand', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([quantumAccount, watchedAccount, algo25Account])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        const latest = bodies[bodies.length - 1]

        expect(
            latest.accounts.map(({ address, chain, account_type }) => ({
                address,
                chain,
                account_type,
            })),
        ).toEqual([
            {
                address: addressOf(quantumAccount),
                chain: ALGORAND_MAINNET,
                account_type: 'quantum',
            },
            {
                address: addressOf(watchedAccount),
                chain: ALGORAND_MAINNET,
                account_type: 'watch',
            },
            {
                address: addressOf(algo25Account),
                chain: ALGORAND_MAINNET,
                account_type: 'algo25',
            },
        ])
    })

    it('registers an account holding an Ethereum address once per chain', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([hdAccountWithEthereum])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        expect(bodies[bodies.length - 1].accounts).toEqual([
            {
                address: HD_TEST_ADDRESS,
                chain: ALGORAND_MAINNET,
                account_type: 'hdWallet',
                receive_notifications: true,
            },
            {
                address: ETH_ADDRESS,
                chain: 'eip155:1',
                account_type: 'hdWallet',
                receive_notifications: true,
            },
        ])
    })

    it('re-registers with the Ethereum item once discovery enables Ethereum on a registered account', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )
        const { ethereum, ...algorandOnly } = hdAccountWithEthereum.chains
        seedAccounts([{ ...hdAccountWithEthereum, chains: algorandOnly }])
        renderApp()
        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        const registeredBefore = bodies.length
        expect(
            bodies[bodies.length - 1].accounts.map(account => account.chain),
        ).toEqual([ALGORAND_MAINNET])

        act(() =>
            seedAccounts([
                {
                    ...hdAccountWithEthereum,
                    chains: {
                        ...algorandOnly,
                        ethereum: { ...ethereum!, enabledBy: 'discovery' },
                    },
                },
            ]),
        )

        await waitFor(
            () => expect(bodies.length).toBeGreaterThan(registeredBefore),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(bodies[bodies.length - 1].accounts).toContainEqual({
            address: ETH_ADDRESS,
            chain: 'eip155:1',
            account_type: 'hdWallet',
            receive_notifications: true,
        })
    })

    it.each(['unknown_chain', 'chain_not_enabled'])(
        'registers the Algorand accounts again when the backend refuses a chain with %s',
        async code => {
            const bodies: DeviceRegistrationRequest[] = []
            server.use(
                http.post('*/api/v4/devices/', async ({ request }) => {
                    const body =
                        (await request.json()) as DeviceRegistrationRequest
                    bodies.push(body)
                    return body.accounts.some(account =>
                        account.chain.startsWith('eip155:'),
                    )
                        ? HttpResponse.json(
                              { error: 'Refused chain', code },
                              { status: 422 },
                          )
                        : HttpResponse.json({ id: 'DEV-1' })
                }),
            )

            seedAccounts([hdAccountWithEthereum])
            renderApp()

            await waitFor(
                () => expect(useDeviceStore.getState().deviceIDs.size).toBe(1),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            expect(bodies[bodies.length - 1].accounts).toEqual([
                expect.objectContaining({
                    address: HD_TEST_ADDRESS,
                    chain: ALGORAND_MAINNET,
                }),
            ])
        },
    )

    it('sends the required fields and none of the v1-only ones', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([quantumAccount])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        const latest = bodies[bodies.length - 1]

        expect(latest.app_version).toBeTruthy()
        expect(latest.locale).toBeTruthy()
        expect(latest.push_token).toBeDefined()
        expect(latest).not.toHaveProperty('model')
        expect(latest).not.toHaveProperty('application')
        expect(latest).not.toHaveProperty('is_watch_account')
    })

    it('re-registers with the new currency when the user changes it', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([quantumAccount])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(bodies[0].currency).toBe('USD')

        act(() => {
            useCurrenciesStore.getState().setPreferredCurrency('EUR')
        })

        await waitFor(
            () =>
                expect(bodies.some(body => body.currency === 'EUR')).toBe(true),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    it('carries the device id on the registration that follows the first', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([quantumAccount])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(bodies[0].id).toBeUndefined()

        addAccount(algo25Account)

        await waitFor(() => expect(bodies.length).toBeGreaterThan(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(bodies[bodies.length - 1].id).toBe('DEV-1')
    })

    it('registers a muted account with receive_notifications false and an unmuted one with true, in the same body', async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        // Mute one account BEFORE mounting the registrar so the first
        // (and only) registration this test drives already reflects the
        // muted/unmuted split — no need to wait on a second effect tick.
        const { result: notifications } = renderHook(() =>
            useNotificationPreferences(),
        )
        notifications.current.setAccountEnabled(addressOf(algo25Account), false)

        seedAccounts([quantumAccount, algo25Account])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        const latest = bodies[bodies.length - 1]

        expect(latest.accounts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    address: addressOf(quantumAccount),
                    receive_notifications: true,
                }),
                expect.objectContaining({
                    address: addressOf(algo25Account),
                    receive_notifications: false,
                }),
            ]),
        )
    })

    it("re-registers with the app's new language when the user switches it", async () => {
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v4/devices/', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([watchedAccount])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(bodies[bodies.length - 1].locale).toBe('en')

        await act(async () => {
            await i18n.changeLanguage('de')
        })

        await waitFor(
            () => expect(bodies[bodies.length - 1].locale).toBe('de'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
    })

    it('stays on v3 with only the Algorand accounts while the v4 flag is off', async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', false)
        const bodies: DeviceRegistrationRequest[] = []
        server.use(
            http.post('*/api/v3/devices', async ({ request }) => {
                bodies.push((await request.json()) as DeviceRegistrationRequest)
                return HttpResponse.json({ id: 'DEV-1' })
            }),
        )

        seedAccounts([hdAccountWithEthereum])
        renderApp()

        await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })

        expect(bodies[bodies.length - 1].accounts).toEqual([
            {
                address: HD_TEST_ADDRESS,
                account_type: 'hdWallet',
                receive_notifications: true,
            },
        ])
    })
})
