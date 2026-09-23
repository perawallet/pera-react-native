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
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    EXTENSION_PAGE_SENDER,
    createLocalChromeFake,
    type LocalChromeFake,
} from './chrome-fake'

const KID = 'k'.repeat(43)
const CHECK_ORIGIN = 'https://integrity-staging.perawallet.app'
const NOW = Date.parse('2026-09-23T12:00:00.000Z')
const markers = new Map<string, { kid: string; enrolledAt: string }>()
const mockGetInstallKeyId = vi.fn(async () => KID)
const mockEnrolDevice = vi.fn()
const mockResumeIntegrityMint = vi.fn(async () => {})
const flags = { mint: true, enrol: true }

vi.mock('@perawallet/wallet-core-app-integrity/api', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-app-integrity/api')
    >('@perawallet/wallet-core-app-integrity/api')
    return { ...actual, enrolDevice: mockEnrolDevice }
})

vi.mock('@perawallet/wallet-extension-platform-chrome', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-extension-platform-chrome')
    >('@perawallet/wallet-extension-platform-chrome')
    return {
        ...actual,
        getInstallKeyId: mockGetInstallKeyId,
        exportInstallPublicKey: async () => 'spki-b64',
        ensureDeviceInstallationID: async () => 'install-1',
        getEnrolmentMarker: async (network: string) =>
            markers.get(network) ?? null,
        putEnrolmentMarker: async (
            network: string,
            marker: { kid: string; enrolledAt: string },
        ) => {
            markers.set(network, marker)
        },
    }
})

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        config: {
            ...actual.config,
            get webIntegrityMintEnabled() {
                return flags.mint
            },
            get webIntegrityEnrolEnabled() {
                return flags.enrol
            },
            integrityCheckOrigin: CHECK_ORIGIN,
        },
    }
})

vi.mock('../integrity', () => ({
    resumeIntegrityMint: mockResumeIntegrityMint,
}))

const ATTEMPT_KEY = 'integrity:enrol-attempt'
const BACKOFF_KEY = 'integrity:enrol-backoff'
const NEEDED_KEY = 'integrity:enrol-needed'

describe('integrity enrolment', () => {
    let fake: LocalChromeFake

    beforeAll(() => vi.useFakeTimers())
    afterAll(() => vi.useRealTimers())
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        vi.setSystemTime(NOW)
        markers.clear()
        flags.mint = true
        flags.enrol = true
        fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
    })

    const load = () => import('../integrity-enrol')

    describe('requestEnrolment', () => {
        it('does nothing while either flag is off', async () => {
            flags.enrol = false
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
            expect(fake.session.has(ATTEMPT_KEY)).toBe(false)
        })

        it('asks the page to host a check bound to this key and a fresh token', async () => {
            const {
                requestEnrolment,
                ENROL_DEADLINE_MS,
                INTEGRITY_ENROL_DEADLINE_ALARM,
            } = await load()

            const decision = await requestEnrolment('onboarding-complete')

            expect(decision.action).toBe('host')
            if (decision.action !== 'host') return
            const url = new URL(decision.url)
            expect(url.origin + url.pathname).toBe(`${CHECK_ORIGIN}/check`)
            expect(url.searchParams.get('kid')).toBe(KID)
            const attempt = fake.session.get(ATTEMPT_KEY) as Record<
                string,
                unknown
            >
            expect(url.searchParams.get('peraCheckToken')).toBe(attempt.token)
            expect(attempt).toMatchObject({
                kid: KID,
                network: 'mainnet',
                surface: 'frame',
                isReady: false,
                phase: 'checking',
                deadlineAt: NOW + ENROL_DEADLINE_MS,
            })
            expect(decision.deadlineAt).toBe(NOW + ENROL_DEADLINE_MS)
            expect(fake.alarms.has(INTEGRITY_ENROL_DEADLINE_ALARM)).toBe(true)
        })

        it('does nothing once this key is enrolled on the active network, and clears the needed flag', async () => {
            markers.set('mainnet', { kid: KID, enrolledAt: 'x' })
            fake.session.set(NEEDED_KEY, 1)
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('enrolment-needed')).toEqual({
                action: 'none',
            })
            expect(fake.session.has(NEEDED_KEY)).toBe(false)
        })

        it('still enrols when only another network knows this key', async () => {
            markers.set('testnet', { kid: KID, enrolledAt: 'x' })
            const { requestEnrolment } = await load()

            expect((await requestEnrolment('page-open')).action).toBe('host')
        })

        it('gives the second page nothing while an attempt is live', async () => {
            const { requestEnrolment } = await load()
            await requestEnrolment('page-open')

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
        })

        it('starts over once the previous attempt has passed its deadline', async () => {
            const { requestEnrolment, ENROL_DEADLINE_MS } = await load()
            await requestEnrolment('page-open')
            vi.setSystemTime(NOW + ENROL_DEADLINE_MS + 1)

            expect((await requestEnrolment('page-open')).action).toBe('host')
        })

        it('waits out the backoff', async () => {
            fake.session.set(BACKOFF_KEY, {
                failures: 1,
                nextAttemptAt: NOW + 60_000,
            })
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
        })

        it('answers nothing instead of throwing', async () => {
            mockGetInstallKeyId.mockRejectedValueOnce(new Error('no IndexedDB'))
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
        })
    })

    describe('enrol request route', () => {
        const request = {
            scope: 'pera-integrity-enrol',
            kind: 'request',
            reason: 'page-open',
        }

        it('answers an extension page with the decision', async () => {
            const { installIntegrityEnrolRequestRoute } = await load()
            installIntegrityEnrolRequestRoute()

            const response = await fake.sendMessage(
                request,
                EXTENSION_PAGE_SENDER,
            )

            expect((response as { action: string }).action).toBe('host')
        })

        it('answers anyone else with nothing', async () => {
            const { installIntegrityEnrolRequestRoute } = await load()
            installIntegrityEnrolRequestRoute()

            const response = await fake.sendMessage(request, {
                id: 'ext-id',
                url: 'https://evil.example/',
                tab: { id: 7 } as chrome.tabs.Tab,
            })

            expect(response).toEqual({ action: 'none' })
            expect(fake.session.has(ATTEMPT_KEY)).toBe(false)
        })
    })
})
