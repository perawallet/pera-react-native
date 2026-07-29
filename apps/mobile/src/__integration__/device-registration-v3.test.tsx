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

// Acceptance test for the whole PERA-4705 device-API-v3 migration: the swap
// backend can only price a quantum account's fee correctly once device
// registration reports `account_type: 'quantum'` for its address. Everything
// else in the migration (endpoints, serializers, the account-type mapping) is
// machinery in service of this one assertion.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// The default driver mock in vitest.setup.ts predates the v3 payload (its
// `deviceInfo` stub exposes `getVersion`, not `getAppVersion`) — mirrors
// migration-inbox.test.tsx. Unmocking routes `getProvider()` (already real
// for every integration test, see vitest.integration-setup.ts) through the
// real in-memory driver at test-utils/platform-driver-test.ts, whose
// `deviceInfo.getAppVersion()` is what `useDevice`'s registration payload
// actually calls.
vi.unmock('@perawallet/wallet-extension-platform-driver')
// The real driver above imports `MemoryKeyValueStorage` (a value, not just a
// type) from `@perawallet/wallet-extension-platform`; the default mock in
// vitest.setup.ts only exports constants, so it must be unmocked too — same
// pairing migration-inbox.test.tsx uses.
vi.unmock('@perawallet/wallet-extension-platform')

import { server, http, HttpResponse } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    clearRegistrationQueuesForTests,
    useDeviceRegistration,
    useDeviceStore,
    type DeviceRegistrationRequest,
} from '@perawallet/wallet-core-device'
import { useNotificationPreferences } from '@perawallet/wallet-core-messages'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'

const INTEGRATION_TIMEOUT = 30_000

// Other quantum integration suites (rekey-quantum.test.tsx,
// send-from-quantum.test.tsx, ...) gate quantum-account UI behind this
// remote-config flag. Registration itself doesn't branch on it (see
// `buildDeviceAccountRegistrations` in packages/accounts/src/device-accounts.ts
// — it maps every `AccountType` unconditionally), but enabling it keeps this
// suite's seeded quantum account consistent with how one would actually
// reach the store in the running app.
const QUANTUM_FLAG_KEY = 'enable_quantum_accounts'

// Mirrors production's `DeviceRegistrar` in RootComponent.tsx: join the
// accounts store + notification preferences into the registration payload
// and drive `useDeviceRegistration`. No migration gating here — this suite
// isn't exercising the migration flow (see migration-inbox.test.tsx for
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
// from the package's public entry (mirrors account-management.test.tsx), so
// drive resets through the hook.
const resetNotificationPreferences = (): void => {
    const { result } = renderHook(() => useNotificationPreferences())
    result.current.disabledAccounts.forEach(addr => {
        result.current.setAccountEnabled(addr, true)
    })
}

const quantumAccount: WalletAccount = {
    id: 'quantum-1',
    type: AccountTypes.quantum,
    address: QUANTUM_TEST_ADDRESS,
    keyPairId: 'quantum-1-key',
    name: 'Quantum account',
}

const watchedAccount: WalletAccount = {
    id: 'watch-1',
    type: AccountTypes.watch,
    address: HD_TEST_ADDRESS,
    name: 'Watched account',
}

const algo25Account: WalletAccount = {
    id: 'algo25-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'algo25-1-key',
    name: 'Algo25 account',
}

describe('Device registration v3 (PERA-4705)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    beforeEach(async () => {
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        clearRegistrationQueuesForTests()
        resetNotificationPreferences()
        await useRemoteConfigStore.persist.rehydrate()
        useRemoteConfigStore
            .getState()
            .setConfigOverride(QUANTUM_FLAG_KEY, true)
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
        clearRegistrationQueuesForTests()
        resetNotificationPreferences()
        useRemoteConfigStore.getState().resetState()
        server.resetHandlers()
    })

    it(
        'registers a quantum account with account_type quantum',
        async () => {
            const bodies: DeviceRegistrationRequest[] = []
            server.use(
                http.post('*/api/v3/devices', async ({ request }) => {
                    bodies.push(
                        (await request.json()) as DeviceRegistrationRequest,
                    )
                    return HttpResponse.json({ id: 'DEV-1' })
                }),
            )

            seedAccounts([quantumAccount, watchedAccount])
            renderApp()

            await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
                timeout: INTEGRATION_TIMEOUT,
            })
            const latest = bodies[bodies.length - 1]

            expect(latest.accounts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        address: quantumAccount.address,
                        account_type: 'quantum',
                        receive_notifications: true,
                    }),
                    expect.objectContaining({
                        address: watchedAccount.address,
                        account_type: 'watch',
                    }),
                ]),
            )
        },
        INTEGRATION_TIMEOUT,
    )

    it(
        'sends the required v3 fields and none of the v1-only ones',
        async () => {
            const bodies: DeviceRegistrationRequest[] = []
            server.use(
                http.post('*/api/v3/devices', async ({ request }) => {
                    bodies.push(
                        (await request.json()) as DeviceRegistrationRequest,
                    )
                    return HttpResponse.json({ id: 'DEV-1' })
                }),
            )

            seedAccounts([quantumAccount])
            renderApp()

            await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
                timeout: INTEGRATION_TIMEOUT,
            })
            const latest = bodies[bodies.length - 1]

            expect(latest.app_version).toBeTruthy()
            expect(latest.locale).toBeTruthy()
            expect(latest.push_token).toBeDefined()
            expect(latest).not.toHaveProperty('model')
            expect(latest).not.toHaveProperty('application')
            expect(latest).not.toHaveProperty('is_watch_account')
        },
        INTEGRATION_TIMEOUT,
    )

    it(
        'carries the device id on the registration that follows the first',
        async () => {
            const bodies: DeviceRegistrationRequest[] = []
            server.use(
                http.post('*/api/v3/devices', async ({ request }) => {
                    bodies.push(
                        (await request.json()) as DeviceRegistrationRequest,
                    )
                    return HttpResponse.json({ id: 'DEV-1' })
                }),
            )

            seedAccounts([quantumAccount])
            renderApp()

            await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
                timeout: INTEGRATION_TIMEOUT,
            })
            expect(bodies[0].id).toBeUndefined()

            // No `addAccount` harness helper exists yet — drive the accounts
            // store directly, per the task brief's fallback instruction.
            addAccount(algo25Account)

            await waitFor(() => expect(bodies.length).toBeGreaterThan(1), {
                timeout: INTEGRATION_TIMEOUT,
            })
            expect(bodies[bodies.length - 1].id).toBe('DEV-1')
        },
        INTEGRATION_TIMEOUT,
    )

    it(
        'registers a muted account with receive_notifications false and an unmuted one with true, in the same body',
        async () => {
            const bodies: DeviceRegistrationRequest[] = []
            server.use(
                http.post('*/api/v3/devices', async ({ request }) => {
                    bodies.push(
                        (await request.json()) as DeviceRegistrationRequest,
                    )
                    return HttpResponse.json({ id: 'DEV-1' })
                }),
            )

            // Mute one account BEFORE mounting the registrar so the first
            // (and only) registration this test drives already reflects the
            // muted/unmuted split — no need to wait on a second effect tick.
            const { result: notifications } = renderHook(() =>
                useNotificationPreferences(),
            )
            notifications.current.setAccountEnabled(
                algo25Account.address,
                false,
            )

            seedAccounts([quantumAccount, algo25Account])
            renderApp()

            await waitFor(() => expect(bodies.length).toBeGreaterThan(0), {
                timeout: INTEGRATION_TIMEOUT,
            })
            const latest = bodies[bodies.length - 1]

            expect(latest.accounts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        address: quantumAccount.address,
                        receive_notifications: true,
                    }),
                    expect.objectContaining({
                        address: algo25Account.address,
                        receive_notifications: false,
                    }),
                ]),
            )
        },
        INTEGRATION_TIMEOUT,
    )
})
