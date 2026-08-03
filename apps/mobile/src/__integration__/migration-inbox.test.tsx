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

import React, { useMemo } from 'react'
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
import { cleanup, screen, waitFor } from '@testing-library/react'

// The real platform package carries the migration types + `StubMigrationService`
// factory the payload builders below rely on; the unit setup replaces it with a
// partial constants-only mock (see vitest.setup.ts). Unmock it here — mirrors
// age-gate.spec.tsx — so the real driver, provider singleton, and test-utils
// helpers all run against the genuine implementation.
vi.unmock('@perawallet/wallet-extension-platform')

// The default driver mock in vitest.setup.ts predates migration and exposes no
// `migration` service, so the provider singleton would resolve
// `getProvider().migration` to undefined. Unmock the driver so the provider
// uses the real in-memory test driver (apps/mobile/src/test-utils/
// platform-driver-test.ts), which Task 1 extended with the migration service.
vi.unmock('@perawallet/wallet-extension-platform-driver')

import { mnemonicToSecretKey } from 'algosdk'
import { server, http, HttpResponse } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { getPlatformServices } from '@test-utils/platform-driver-test'
import { Networks } from '@perawallet/wallet-core-config'
import {
    createStubMigrationService,
    createEmptyLegacyMigrationData,
    type LegacyAccount,
    type LegacyDeviceIdentifiers,
    type LegacyMigrationData,
    type MigrationService,
} from '@perawallet/wallet-extension-platform'
import {
    useAccountsStore,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    useDeviceRegistration,
    useDeviceStore,
    type DeviceRegistrationRequest,
} from '@perawallet/wallet-core-device'
import { MigrationSplashScreen } from '@modules/migration/screens/MigrationSplashScreen'
import { InboxScreen } from '@modules/messages/screens/InboxScreen/InboxScreen'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS as REKEYED_TEST_ADDRESS,
} from './__fixtures__/onboarding'

const INTEGRATION_TIMEOUT = 30_000
const LEGACY_DEVICE_ID = 'LEGACY-DEVICE-1'
// Distinct from `LEGACY_DEVICE_ID` on purpose — see the handler comment
// below. Answering an id-less create with this instead of the legacy id
// means the "the legacy id was reused" assertion can only pass if the app
// actually sent `LEGACY_DEVICE_ID` on the wire, never by coincidental echo.
const FRESHLY_MINTED_DEVICE_ID = 'FRESHLY-MINTED-DEVICE'

// Legacy payload builders. These wrap `createEmptyLegacyMigrationData()` so a
// test only spells out the accounts + device id it asserts on.

// A signable Pera 6 standard account: the 64-byte tweetnacl secret key whose
// first 32 bytes are the ed25519 seed for ALGO25_TEST_ADDRESS. `runMigration`
// re-derives the algo25 mnemonic from those seed bytes and imports the key, so
// the account lands in the store with real signing material.
const legacyAlgo25Account = (address: string): LegacyAccount => ({
    address,
    name: 'Trading',
    type: 'standard',
    preferredOrder: 0,
    isBackedUp: true,
    secretKey: mnemonicToSecretKey(ALGO25_TEST_MNEMONIC).sk,
    hdWalletId: null,
    ledger: null,
    joint: null,
    authAddress: null,
})

// A keyless (watch) account rekeyed to a signing account: `buildWatchAccount`
// mirrors `authAddress` onto `rekeyAddress` (Task 9), which is what lets
// `canSignWith` follow the rekey to the signable auth account and pull this
// address into the inbox signing set.
const legacyKeylessAccount = (
    address: string,
    { authAddress }: { authAddress: string },
): LegacyAccount => ({
    address,
    name: 'Rekeyed',
    type: 'watch',
    preferredOrder: 1,
    isBackedUp: false,
    secretKey: null,
    hdWalletId: null,
    ledger: null,
    joint: null,
    authAddress,
})

const legacyPayloadWith = ({
    accounts,
    deviceIdentifiers,
}: {
    accounts: LegacyAccount[]
    deviceIdentifiers: Partial<LegacyDeviceIdentifiers>
}): LegacyMigrationData => {
    const base = createEmptyLegacyMigrationData('ios')
    return {
        ...base,
        accounts,
        deviceIdentifiers: { ...base.deviceIdentifiers, ...deviceIdentifiers },
    }
}

// The platform provider owns the migration service; both `useNeedsMigration`
// and the splash's `runMigration` read `getProvider().migration`, which
// resolves to the test driver's cached migration object. Rebind that object's
// methods to a fresh stub so the migration runs against our legacy payload —
// the provider references this same object at runtime.
const installStubMigrationService = (
    options: Parameters<typeof createStubMigrationService>[0],
): void => {
    const stub = createStubMigrationService(options)
    const target = getPlatformServices().migration
    const rebound: MigrationService = {
        hasLegacyData: () => stub.hasLegacyData(),
        getLegacyData: () => stub.getLegacyData(),
        isMigrationComplete: () => stub.isMigrationComplete(),
        markMigrationComplete: platform => stub.markMigrationComplete(platform),
        clearMigrationComplete: () => stub.clearMigrationComplete(),
        getMigrationPlans: () => stub.getMigrationPlans(),
        simulateLegacyDatabase: () => stub.simulateLegacyDatabase(),
        simulatePreSixxAccounts: () => stub.simulatePreSixxAccounts(),
        resetLegacyData: () => stub.resetLegacyData(),
        getCompletedStepVersions: () => stub.getCompletedStepVersions(),
        setCompletedStepVersions: versions =>
            stub.setCompletedStepVersions(versions),
    }
    Object.assign(target, rebound)
}

// App-ish harness. Mirrors production's RootComponent gating: the migration
// splash runs first (driving the real `runMigration`), then — once the store
// holds the migrated accounts AND the legacy device id has been written (the
// device step runs last, after accounts) — it swaps to the device registrar +
// inbox, exactly as RootComponent does behind `!migrationInProgress`.

// Mirrors production's `DeviceRegistrar` in RootComponent.tsx: v3 registers
// account-type + notification-preference pairs, not bare addresses.
const InboxWithDeviceRegistration = () => {
    const registrations = useDeviceAccountRegistrations()
    useDeviceRegistration(registrations)
    return <InboxScreen />
}

const MigratedUserApp = () => {
    const accounts = useAllAccounts()
    const addresses = useMemo(
        () => accounts.map(account => account.address),
        [accounts],
    )
    const legacyDeviceId = useDeviceStore(state =>
        state.deviceIDs.get(Networks.mainnet),
    )
    const migrationSettled = addresses.length >= 2 && !!legacyDeviceId

    return migrationSettled ? (
        <InboxWithDeviceRegistration />
    ) : (
        <MigrationSplashScreen />
    )
}

describe('Flow: Pera 6 migration → asset inbox', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    // Unmount first — see messages.test.tsx: resetting handlers while a
    // polling screen is mounted turns the next poll into an MSW warning that
    // races vitest's worker teardown.
    afterEach(() => {
        cleanup()
        server.resetHandlers()
    })
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useDeviceStore.getState().resetState()
    })

    it(
        'migrated accounts (incl. rekeyed) appear in the inbox request and ASA rows render',
        async () => {
            const inboxBodies: Array<{ addresses: string[] }> = []
            let deviceBody: DeviceRegistrationRequest | null = null

            server.use(
                http.post('*/api/v3/devices', async ({ request }) => {
                    deviceBody =
                        (await request.json()) as DeviceRegistrationRequest
                    // Deliberately NOT `deviceBody.id ?? LEGACY_DEVICE_ID`:
                    // that would answer an id-less create with the same
                    // value the assertion below checks for, so a regression
                    // where the app forgets to send the already-known legacy
                    // id would still get told "LEGACY_DEVICE_ID" back — and
                    // if a second registration fired anywhere in this render
                    // it would then correctly echo the (wrongly-reused)
                    // legacy id, passing the assertion for the wrong reason.
                    // A distinct sentinel means the legacy id can only ever
                    // appear in a captured request body if the app actually
                    // sent it.
                    return HttpResponse.json({
                        id: deviceBody.id ?? FRESHLY_MINTED_DEVICE_ID,
                    })
                }),
                http.post('*/v1/inbox/:deviceId/', async ({ request }) => {
                    inboxBodies.push(
                        (await request.json()) as { addresses: string[] },
                    )
                    return HttpResponse.json({
                        joint_account_import_requests: [],
                        joint_account_sign_requests: [],
                        asa_inboxes: [
                            {
                                address: ALGO25_TEST_ADDRESS,
                                inbox_address: null,
                                request_count: 2,
                            },
                        ],
                    })
                }),
            )

            installStubMigrationService({
                hasData: true,
                data: legacyPayloadWith({
                    accounts: [
                        legacyAlgo25Account(ALGO25_TEST_ADDRESS),
                        legacyKeylessAccount(REKEYED_TEST_ADDRESS, {
                            authAddress: ALGO25_TEST_ADDRESS,
                        }),
                    ],
                    deviceIdentifiers: {
                        mainnetDeviceId: LEGACY_DEVICE_ID,
                    },
                }),
            })

            // Mounting the migration splash runs `runMigration`, which
            // imports the algo25 key, adds the rekeyed watch account, and
            // writes the legacy device id. The harness then swaps to the
            // device registrar + inbox.
            renderWithNavigation(MigratedUserApp, 'MigratedUserApp')

            // The device registration carried the *legacy* id (the migrated
            // device id was reused, not a freshly minted one) — the id
            // already sat in `useDeviceStore` when `DeviceRegistrar` mounted,
            // so `useDevice.registerDevice` went straight to the
            // known-id branch rather than an id-less create.
            await waitFor(() => expect(deviceBody?.id).toBe(LEGACY_DEVICE_ID), {
                timeout: INTEGRATION_TIMEOUT,
            })

            // The inbox request scopes to BOTH migrated addresses — the
            // rekeyed keyless account is only present because Task 9 mirrors
            // its legacy authAddress onto rekeyAddress, making it signable.
            await waitFor(
                () =>
                    expect(inboxBodies.at(-1)?.addresses).toEqual(
                        expect.arrayContaining([
                            ALGO25_TEST_ADDRESS,
                            REKEYED_TEST_ADDRESS,
                        ]),
                    ),
                { timeout: INTEGRATION_TIMEOUT },
            )

            // The ASA-inbox row renders (i18n falls back to the raw key under
            // the integration setup, as in messages.test.tsx).
            await waitFor(
                () => {
                    expect(
                        screen.getAllByText((_, node) =>
                            (node?.textContent ?? '').includes(
                                'messages.inbox.asa_requests',
                            ),
                        ).length,
                    ).toBeGreaterThan(0)
                },
                { timeout: INTEGRATION_TIMEOUT },
            )
        },
        INTEGRATION_TIMEOUT,
    )
})
