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
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { http, HttpResponse } from 'msw'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { PeraWebImportLoadingScreen } from '@modules/onboarding/screens/PeraWebImportLoadingScreen'
import { PeraWebImportResultScreen } from '@modules/onboarding/screens/PeraWebImportResultScreen'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks/peraWebImportFlowStore'
import { parsePeraWebQrPayload } from '@perawallet/wallet-core-backup'
import { config } from '@perawallet/wallet-core-config'
import { useDeepLink } from '@hooks/useDeepLink'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@test-utils/render'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    PERA_WEB_BACKUP_ID,
    PERA_WEB_KEY_BYTES,
    buildMultiAccountPeraWebBackup,
    buildPeraWebImportUrl,
    buildPeraWebQrString,
    buildSingleAccountPeraWebBackup,
} from './__fixtures__/peraWeb'

// Loading screen runs through fetch → decrypt → keystore commits → store
// rewrites; mirrors the ASB flow's slow-test timeout.
const SLOW_TEST_TIMEOUT_MS = 30_000

/**
 * Mount the Loading screen as the initial route with the result screen
 * registered behind it. The Loading hook reads `qr` from the flow store
 * (set in `beforeEach`/per-test) and runs the pipeline on mount; on
 * completion it `navigation.replace`s to PeraWebImportResult, which the
 * test navigator picks up because it lives in `additionalScreens`.
 *
 * We bypass the QR scan + deeplink dispatch in these tests because the
 * dispatcher uses `navigationRef` (the global one), which is a noop under
 * the integration test navigator. The QR + deeplink path has its own
 * targeted test below — see "QR scan integration".
 */
const renderLoadingWithFlowStore = () =>
    renderWithNavigation(PeraWebImportLoadingScreen, 'PeraWebImportLoading', {
        additionalScreens: [
            {
                name: 'PeraWebImportResult',
                component: PeraWebImportResultScreen,
            },
        ],
    })

// MSW handlers are URL-pattern based. The Pera mobile API base is staging by
// default in the test build (`packages/config/src/main.ts`). Match both
// mainnet and testnet hosts so the test doesn't have to know which network
// the active provider stub returned.
const backupUrlFor = (host: string, backupId = PERA_WEB_BACKUP_ID) =>
    `${host}/v1/backups/${backupId}/`

const installBackupHandler = (response: {
    status: number
    encryptedContent?: string | null
}) => {
    const respond = () => {
        if (response.status !== 200) {
            return new HttpResponse(null, { status: response.status })
        }
        return HttpResponse.json({
            id: PERA_WEB_BACKUP_ID,
            type: 'transfer',
            encrypted_content: response.encryptedContent ?? null,
            creator_device: 'fixture-device',
        })
    }
    server.use(
        http.get(backupUrlFor(config.mainnetBackendUrl), respond),
        http.get(backupUrlFor(config.testnetBackendUrl), respond),
    )
}

/**
 * Seed the flow store with what the deeplink dispatcher would have written
 * after a successful QR scan. The Loading screen reads `qr` on mount; this
 * helper lets the test stand in for the QR scanner.
 */
const seedQrInFlowStore = (
    overrides?: Parameters<typeof buildPeraWebQrString>[0],
) => {
    const qrString = buildPeraWebQrString(overrides)
    const parsed = parsePeraWebQrPayload(qrString)
    usePeraWebImportFlowStore.getState().setQr(parsed)
}

describe('Flow: Pera Web Import — Loading → Result pipeline', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        usePeraWebImportFlowStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it(
        'Given a valid QR + backup with one account, the account lands in the wallet and the result screen renders',
        async () => {
            installBackupHandler({
                status: 200,
                encryptedContent: buildSingleAccountPeraWebBackup({
                    name: 'My Web Account',
                }),
            })
            seedQrInFlowStore()

            renderLoadingWithFlowStore()

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(1)
                },
                { timeout: 10_000 },
            )

            const [account] = useAccountsStore.getState().accounts
            expect(account.type).toBe(AccountTypes.algo25)
            expect(account.address).toBe(ALGO25_TEST_ADDRESS)
            expect(account.name).toBe('My Web Account')

            await waitFor(() => screen.getByTestId('pera_web_import_result'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a backup with multiple accounts, every account is imported',
        async () => {
            const { encryptedContent, addresses } =
                buildMultiAccountPeraWebBackup()
            installBackupHandler({ status: 200, encryptedContent })
            seedQrInFlowStore()

            renderLoadingWithFlowStore()

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(2)
                },
                { timeout: 10_000 },
            )

            const got = useAccountsStore
                .getState()
                .accounts.map(a => a.address)
                .sort()
            expect(got).toEqual([...addresses].sort())

            for (const a of useAccountsStore.getState().accounts) {
                expect(a.type).toBe(AccountTypes.algo25)
            }
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the QR encryption key does not match the encrypted blob, decryption fails and no account is imported',
        async () => {
            installBackupHandler({
                status: 200,
                encryptedContent: buildSingleAccountPeraWebBackup(),
            })

            // Seed with a 32-byte key that wasn't used to seal the
            // encrypted_content fixture. The blob fetches fine; only the
            // user-supplied key is wrong — parity with scanning a stale QR.
            seedQrInFlowStore({ encryptionKey: new Uint8Array(32).fill(0xff) })

            renderLoadingWithFlowStore()

            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            expect(useAccountsStore.getState().accounts).toHaveLength(0)
            expect(screen.queryByTestId('pera_web_import_result')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an account in the backup is already in the wallet, the import is counted as skipped',
        async () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'pre-seeded',
                    type: AccountTypes.algo25,
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: 'pre-seeded-keypair-id',
                },
            ])

            installBackupHandler({
                status: 200,
                encryptedContent: buildSingleAccountPeraWebBackup({
                    name: 'Web Account',
                }),
            })
            seedQrInFlowStore()

            renderLoadingWithFlowStore()

            await waitFor(() => screen.getByTestId('pera_web_import_result'), {
                timeout: 10_000,
            })

            // Pre-seeded account is still there; no duplicate import.
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            expect(useAccountsStore.getState().accounts[0].id).toBe(
                'pre-seeded',
            )
            // The result screen renders the "nothing new" variant because
            // the only account in the backup was already in the wallet.
            // (The count chip is a PWResultView child that the test mock
            // drops, so we assert on the variant via its title instead.)
            expect(
                screen.getByText(
                    'onboarding.pera_web_import.result.nothing_new_title',
                ),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the backend returns 500 for the backup, an error toast is raised and no account is imported',
        async () => {
            installBackupHandler({ status: 500 })
            seedQrInFlowStore()

            renderLoadingWithFlowStore()

            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            expect(useAccountsStore.getState().accounts).toHaveLength(0)
            expect(screen.queryByTestId('pera_web_import_result')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user finishes the flow successfully, decrypted private keys are zeroed in place and the flow store is empty by the time the result screen renders',
        async () => {
            installBackupHandler({
                status: 200,
                encryptedContent: buildSingleAccountPeraWebBackup(),
            })
            seedQrInFlowStore()

            // Hold a reference to the QR encryptionKey before the loading
            // hook runs. Reset() during the flow wipes this Uint8Array in
            // place; the test asserts byte-zeroing, not just that the
            // store reference was dropped.
            const qrKey = usePeraWebImportFlowStore.getState().qr!.encryptionKey
            expect(qrKey.some(b => b !== 0)).toBe(true)

            // Subscribe so we capture the decrypted account.privateKey the
            // instant `setPayload` fires inside the loading hook. By the
            // time the result screen renders the loop has already wiped
            // these buffers in place, so we can't fetch them from the
            // store after the fact.
            let capturedPrivateKey: Uint8Array | null = null
            const unsubscribe = usePeraWebImportFlowStore.subscribe(state => {
                const pk = state.payload?.accounts[0]?.privateKey ?? null
                if (pk && !capturedPrivateKey) capturedPrivateKey = pk
            })

            try {
                renderLoadingWithFlowStore()

                await waitFor(
                    () => screen.getByTestId('pera_web_import_result'),
                    {
                        timeout: 10_000,
                    },
                )
            } finally {
                unsubscribe()
            }

            // By the time the result screen renders, the store is already
            // empty: the loading hook calls reset() before navigating, so
            // an attacker who heap-dumps after the flow completes finds
            // nothing live.
            expect(usePeraWebImportFlowStore.getState().payload).toBeNull()
            expect(usePeraWebImportFlowStore.getState().qr).toBeNull()

            // The actual byte buffers we held references to have been
            // zeroed in place (not just dropped on the floor for GC to
            // eventually pick up).
            expect(capturedPrivateKey).not.toBeNull()
            expect(capturedPrivateKey!.length).toBeGreaterThan(0)
            expect(capturedPrivateKey!.every(b => b === 0)).toBe(true)
            expect(qrKey.every(b => b === 0)).toBe(true)

            // Pressing Done after the cleanup is a no-op for the store
            // and still exits the flow.
            fireEvent.click(
                screen.getByTestId('pera_web_import_result-primary'),
            )
            expect(usePeraWebImportFlowStore.getState().payload).toBeNull()
            expect(usePeraWebImportFlowStore.getState().qr).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

describe('Entry: QR scan → deeplink dispatch → Loading pipeline', () => {
    // useDeepLink mounts the signing pipeline (via useWalletConnect →
    // useSigningRequest → useMultisigTransportAdapters), which calls
    // useQueryClient. renderHook makes its own tree so we wrap it with a
    // QueryClientProvider matching the walletconnect-pair test pattern.
    const hookQueryClient = createTestQueryClient()
    const HookWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={hookQueryClient}>
            {children}
        </QueryClientProvider>
    )

    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        usePeraWebImportFlowStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it(
        'Given a JSON QR payload, when handleDeepLink dispatches it with source="qr", then the flow store is seeded with the parsed payload and the loading screen completes the import',
        async () => {
            installBackupHandler({
                status: 200,
                encryptedContent: buildSingleAccountPeraWebBackup({
                    name: 'Scanned Account',
                }),
            })

            // Drive the real dispatcher: this exercises parseDeeplink's JSON
            // sniff → parsePeraWebQrPayload → usePeraWebImportDeeplink →
            // store.setQr. The dispatcher also tries to navigate via the
            // global navigationRef, which is a noop under the integration
            // navigator — that part is asserted in useDeepLink.test.ts.
            // Here we assert the side effect that actually bridges to the
            // import pipeline: the flow store ends up populated.
            const { result } = renderHook(() => useDeepLink(), {
                wrapper: HookWrapper,
            })
            await act(async () => {
                await result.current.handleDeepLink(
                    buildPeraWebQrString(),
                    true,
                    'qr',
                )
            })

            const seeded = usePeraWebImportFlowStore.getState().qr
            expect(seeded).not.toBeNull()
            expect(seeded!.backupId).toBe(PERA_WEB_BACKUP_ID)

            // Mount the loading screen against the dispatcher-populated
            // store. This is the same pipeline the production app runs:
            // dispatcher seeds qr → navigation lands on
            // PeraWebImportLoading → its mount hook reads qr → fetch +
            // decrypt + import.
            renderLoadingWithFlowStore()

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(1)
                },
                { timeout: 10_000 },
            )

            const [account] = useAccountsStore.getState().accounts
            expect(account.type).toBe(AccountTypes.algo25)
            expect(account.address).toBe(ALGO25_TEST_ADDRESS)
            expect(account.name).toBe('Scanned Account')

            await waitFor(() => screen.getByTestId('pera_web_import_result'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the same JSON payload arrives via source="deeplink" (not a QR scan), then it is ignored and no import is staged',
        async () => {
            // A malicious deeplink could embed the JSON shape directly;
            // production gates the handler on source==="qr" so a tapped link
            // can't auto-stage an attacker-controlled backup decryption.
            const { result } = renderHook(() => useDeepLink(), {
                wrapper: HookWrapper,
            })
            await act(async () => {
                await result.current.handleDeepLink(
                    buildPeraWebQrString(),
                    true,
                    'deeplink',
                )
            })

            expect(usePeraWebImportFlowStore.getState().qr).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the web-import app-action URL, when dispatched with source="qr", then the flow store is seeded with the parsed payload',
        async () => {
            const { result } = renderHook(() => useDeepLink(), {
                wrapper: HookWrapper,
            })
            await act(async () => {
                await result.current.handleDeepLink(
                    buildPeraWebImportUrl(),
                    true,
                    'qr',
                )
            })

            const seeded = usePeraWebImportFlowStore.getState().qr
            expect(seeded).not.toBeNull()
            expect(seeded!.backupId).toBe(PERA_WEB_BACKUP_ID)
            expect(Array.from(seeded!.encryptionKey)).toEqual(Array.from(PERA_WEB_KEY_BYTES))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the web-import app-action URL arrives via source="deeplink" (a tapped link), then it is ignored and no import is staged',
        async () => {
            // QR-only by design (PERA-4747): a tappable link would put the
            // backup encryption key in a URL, so the handler drops non-QR
            // sources. This pins the decided policy for the URL form too.
            const { result } = renderHook(() => useDeepLink(), {
                wrapper: HookWrapper,
            })
            await act(async () => {
                await result.current.handleDeepLink(
                    buildPeraWebImportUrl(),
                    true,
                    'deeplink',
                )
            })

            expect(usePeraWebImportFlowStore.getState().qr).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
