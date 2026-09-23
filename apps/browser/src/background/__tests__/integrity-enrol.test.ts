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
        // A liveness timer left by an earlier test would otherwise fire into this one.
        vi.clearAllTimers()
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
        it.each([
            [
                'the mint flag',
                () => {
                    flags.mint = false
                },
            ],
            [
                'the enrol flag',
                () => {
                    flags.enrol = false
                },
            ],
        ])('does nothing while %s is off', async (_label, arrange) => {
            arrange()
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
        })

        it('arms the deadline alarm for the attempt deadline', async () => {
            const {
                requestEnrolment,
                ENROL_DEADLINE_MS,
                INTEGRITY_ENROL_DEADLINE_ALARM,
            } = await load()
            await requestEnrolment('page-open')

            expect(fake.alarms.get(INTEGRITY_ENROL_DEADLINE_ALARM)).toEqual({
                when: NOW + ENROL_DEADLINE_MS,
            })
        })

        it('leaves no attempt behind when the deadline alarm cannot be armed', async () => {
            vi.spyOn(fake.chrome.alarms, 'create').mockRejectedValueOnce(
                new Error('alarm quota'),
            )
            const { requestEnrolment } = await load()

            expect(await requestEnrolment('page-open')).toEqual({
                action: 'none',
            })
            expect(fake.session.has(ATTEMPT_KEY)).toBe(false)
        })

        it('hosts exactly once when two pages ask at the same moment', async () => {
            const { requestEnrolment } = await load()

            const decisions = await Promise.all([
                requestEnrolment('page-open'),
                requestEnrolment('page-open'),
            ])

            expect(
                decisions.filter(decision => decision.action === 'host'),
            ).toHaveLength(1)
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

        it('leaves other messages to their own listeners', async () => {
            const { installIntegrityEnrolRequestRoute } = await load()
            installIntegrityEnrolRequestRoute()

            await expect(
                fake.sendMessage({ scope: 'other' }, EXTENSION_PAGE_SENDER),
            ).rejects.toThrow('message port closed')
        })
    })

    describe('the check page port', () => {
        const CHECK_SENDER = {
            origin: CHECK_ORIGIN,
            url: `${CHECK_ORIGIN}/check?v=1`,
        }

        // Mirrors a real page: it asks, then holds the host port while the frame is mounted.
        const start = async ({ isHosted = true } = {}) => {
            const module = await load()
            module.installIntegrityEnrolment()
            const decision = await module.requestEnrolment('page-open')
            const token = (fake.session.get(ATTEMPT_KEY) as { token: string })
                .token
            const host = isHosted
                ? fake.connectPort(
                      `pera-integrity-host:${token}`,
                      EXTENSION_PAGE_SENDER,
                  )
                : null
            return { module, decision, token, host }
        }
        const attempt = () =>
            fake.session.get(ATTEMPT_KEY) as Record<string, unknown>
        const connect = (token: string, sender = CHECK_SENDER) =>
            fake.connectPort(`pera-integrity-check:${token}`, sender)
        const solved = {
            type: 'TURNSTILE_SOLVED',
            v: 1,
            kid: KID,
            turnstileToken: 'tok',
        }

        it('leaves ports of other routes alone', async () => {
            await start()
            const other = fake.connectPort(
                'pera-webview-bridge:x',
                CHECK_SENDER,
            )

            expect(other.isDisconnected()).toBe(false)
        })

        it.each([
            [
                'another origin',
                {
                    origin: 'https://evil.example',
                    url: 'https://evil.example/check',
                },
            ],
            [
                'another path',
                { origin: CHECK_ORIGIN, url: `${CHECK_ORIGIN}/other` },
            ],
        ])('refuses a port from %s', async (_label, sender) => {
            const { token } = await start()

            expect(connect(token, sender).isDisconnected()).toBe(true)
        })

        it('marks the frame ready when the page announces itself', async () => {
            const { token } = await start()
            connect(token).deliver({ type: 'PAGE_READY', v: 1, kid: KID })

            await vi.waitFor(() => expect(attempt().isReady).toBe(true))
        })

        it('disconnects a port whose token is not the live attempt', async () => {
            await start()
            const stranger = connect('s'.repeat(22))
            stranger.deliver({ type: 'PAGE_READY', v: 1, kid: KID })

            await vi.waitFor(() => expect(stranger.isDisconnected()).toBe(true))
        })

        it('enrols with the solve, stores the marker and resumes minting', async () => {
            mockEnrolDevice.mockResolvedValue({ enrolled: true, kid: KID })
            fake.session.set(NEEDED_KEY, 1)
            const { module, token } = await start()

            connect(token).deliver(solved)

            await vi.waitFor(() => expect(attempt().phase).toBe('done'))
            expect(mockEnrolDevice).toHaveBeenCalledWith({
                deviceInstallationId: 'install-1',
                publicKey: 'spki-b64',
                turnstileToken: 'tok',
                network: 'mainnet',
            })
            expect(markers.get('mainnet')?.kid).toBe(KID)
            expect(fake.session.has(BACKOFF_KEY)).toBe(false)
            expect(fake.session.has(NEEDED_KEY)).toBe(false)
            expect(fake.alarms.has(module.INTEGRITY_ENROL_DEADLINE_ALARM)).toBe(
                false,
            )
            expect(mockResumeIntegrityMint).toHaveBeenCalledTimes(1)
        })

        it('enrols once when a reconnecting page resends the solve', async () => {
            mockEnrolDevice.mockResolvedValue({ enrolled: true, kid: KID })
            const { token } = await start()
            const first = connect(token)
            first.deliver(solved)
            connect(token).deliver(solved)

            await vi.waitFor(() => expect(attempt().phase).toBe('done'))
            expect(mockEnrolDevice).toHaveBeenCalledTimes(1)
        })

        it.each([
            [
                'the backend rejects it',
                () => mockEnrolDevice.mockRejectedValue(new Error('409')),
            ],
            [
                'it answers for another key',
                () =>
                    mockEnrolDevice.mockResolvedValue({
                        enrolled: true,
                        kid: 'x'.repeat(43),
                    }),
            ],
        ])(
            'records a failure and no marker when %s',
            async (_label, arrange) => {
                arrange()
                const { token } = await start()
                connect(token).deliver(solved)

                await vi.waitFor(() => expect(attempt().phase).toBe('done'))
                expect(markers.has('mainnet')).toBe(false)
                expect(fake.session.has(BACKOFF_KEY)).toBe(true)
                expect(mockResumeIntegrityMint).not.toHaveBeenCalled()
            },
        )

        it('ends the attempt on a framed error', async () => {
            const { token } = await start()
            connect(token).deliver({
                type: 'TURNSTILE_ERROR',
                v: 1,
                kid: KID,
                code: 'TURNSTILE_ERROR',
                detail: '600010',
            })

            await vi.waitFor(() => expect(attempt().phase).toBe('done'))
            expect(fake.session.has(BACKOFF_KEY)).toBe(true)
        })

        it('accepts INVALID_KID with its empty kid and ends the attempt', async () => {
            const { token } = await start()
            connect(token).deliver({
                type: 'TURNSTILE_ERROR',
                v: 1,
                kid: '',
                code: 'INVALID_KID',
            })

            await vi.waitFor(() => expect(attempt().phase).toBe('done'))
        })

        it('disconnects any other message whose kid does not match', async () => {
            const { token } = await start()
            const port = connect(token)
            port.deliver({ ...solved, kid: 'x'.repeat(43) })

            await vi.waitFor(() => expect(port.isDisconnected()).toBe(true))
            expect(mockEnrolDevice).not.toHaveBeenCalled()
        })

        describe('the tab fallback', () => {
            it('opens a tab with a new token when the frame never reports ready', async () => {
                const { token } = await start()

                await vi.advanceTimersByTimeAsync(5000)

                await vi.waitFor(() => expect(attempt().surface).toBe('tab'))
                const tabToken = attempt().token as string
                expect(tabToken).not.toBe(token)
                const [tab] = [...fake.tabs.values()]
                expect(
                    new URL(tab?.url ?? '').searchParams.get('peraCheckToken'),
                ).toBe(tabToken)
            })

            it('keeps the frame when it reported ready in time', async () => {
                const { token } = await start()
                connect(token).deliver({ type: 'PAGE_READY', v: 1, kid: KID })
                await vi.waitFor(() => expect(attempt().isReady).toBe(true))

                await vi.advanceTimersByTimeAsync(5000)

                expect(attempt().surface).toBe('frame')
                expect(fake.tabs.size).toBe(0)
            })

            it('moves to a tab when the page reports Turnstile blocked', async () => {
                const { token } = await start()
                connect(token).deliver({
                    type: 'TURNSTILE_ERROR',
                    v: 1,
                    kid: KID,
                    code: 'TURNSTILE_BLOCKED',
                })

                await vi.waitFor(() => expect(attempt().surface).toBe('tab'))
                expect(attempt().phase).toBe('checking')
            })

            it('keeps a tab attempt open through a retryable error, then enrols and closes it', async () => {
                mockEnrolDevice.mockResolvedValue({ enrolled: true, kid: KID })
                await start()
                await vi.advanceTimersByTimeAsync(5000)
                await vi.waitFor(() => expect(attempt().surface).toBe('tab'))
                const tabToken = attempt().token as string
                const tabId = attempt().tabId as number
                const tabPort = connect(tabToken)

                tabPort.deliver({
                    type: 'TURNSTILE_ERROR',
                    v: 1,
                    kid: KID,
                    code: 'TURNSTILE_EXPIRED',
                })
                await vi.advanceTimersByTimeAsync(0)
                expect(attempt().phase).toBe('checking')

                tabPort.deliver(solved)
                await vi.waitFor(() => expect(attempt().phase).toBe('done'))
                expect(fake.tabs.has(tabId)).toBe(false)
            })

            it('ends the attempt when the user closes the tab', async () => {
                await start()
                await vi.advanceTimersByTimeAsync(5000)
                await vi.waitFor(() => expect(attempt().surface).toBe('tab'))

                fake.closeTab(attempt().tabId as number)

                await vi.waitFor(() => expect(attempt().phase).toBe('done'))
                expect(fake.session.has(BACKOFF_KEY)).toBe(true)
            })
        })

        describe('the hosting page', () => {
            it('ends the attempt quietly when the page closes before the check finishes', async () => {
                const { module, host } = await start()

                host?.close()

                await vi.waitFor(() => expect(attempt().phase).toBe('done'))
                expect(fake.session.has(BACKOFF_KEY)).toBe(false)
                expect(
                    fake.alarms.has(module.INTEGRITY_ENROL_DEADLINE_ALARM),
                ).toBe(false)
                expect(fake.tabs.size).toBe(0)
            })

            it('lets the next page host at once after the previous one closed', async () => {
                const { module, host } = await start()
                host?.close()
                await vi.waitFor(() => expect(attempt().phase).toBe('done'))

                expect(
                    (await module.requestEnrolment('page-open')).action,
                ).toBe('host')
            })

            it('opens no tab when the silent frame has no page left to host it', async () => {
                await start({ isHosted: false })

                await vi.advanceTimersByTimeAsync(5000)

                await vi.waitFor(() => expect(attempt().phase).toBe('done'))
                expect(fake.tabs.size).toBe(0)
                expect(fake.session.has(BACKOFF_KEY)).toBe(false)
            })

            it('leaves an attempt alone once it has moved to a tab', async () => {
                const { host } = await start()
                await vi.advanceTimersByTimeAsync(5000)
                await vi.waitFor(() => expect(attempt().surface).toBe('tab'))

                host?.close()
                await vi.advanceTimersByTimeAsync(0)

                expect(attempt().phase).toBe('checking')
            })

            it('refuses a host port from outside the extension', async () => {
                const { token } = await start({ isHosted: false })

                const stranger = fake.connectPort(
                    `pera-integrity-host:${token}`,
                    CHECK_SENDER,
                )

                expect(stranger.isDisconnected()).toBe(true)
            })
        })

        describe('the deadline', () => {
            it('ends an unfinished attempt', async () => {
                const { module } = await start()
                await module.handleEnrolDeadlineAlarm({
                    name: module.INTEGRITY_ENROL_DEADLINE_ALARM,
                } as chrome.alarms.Alarm)

                expect(attempt().phase).toBe('done')
                expect(fake.session.has(BACKOFF_KEY)).toBe(true)
            })

            it('leaves a finished attempt alone', async () => {
                mockEnrolDevice.mockResolvedValue({ enrolled: true, kid: KID })
                const { module, token } = await start()
                connect(token).deliver(solved)
                await vi.waitFor(() => expect(attempt().phase).toBe('done'))

                await module.handleEnrolDeadlineAlarm({
                    name: module.INTEGRITY_ENROL_DEADLINE_ALARM,
                } as chrome.alarms.Alarm)

                expect(fake.session.has(BACKOFF_KEY)).toBe(false)
            })
        })
    })
})
