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
import { createLocalChromeFake, type LocalChromeFake } from './chrome-fake'

const mockRequestChallenge = vi.fn()
const mockAttestDevice = vi.fn()
const mockSignChallenge = vi.fn()
const mockExportPublicKey = vi.fn()
const mockClearInstallKey = vi.fn()
const mockClearSessionIntegrityToken = vi.fn()
const mockSetIntegrityTokenProvider = vi.fn()

// integrity.ts imports the /api subpath, not the package root — the root
// barrel also re-exports the Zustand store, which this suite must not import
// (see packages/app-integrity/src/api.ts for why).
vi.mock('@perawallet/wallet-core-app-integrity/api', () => ({
    requestChallenge: mockRequestChallenge,
    attestDevice: mockAttestDevice,
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        // Wraps rather than replaces: readIntegrityToken (imported directly
        // in some tests below) must still observe whatever this registers.
        setIntegrityTokenProvider: (
            ...args: Parameters<typeof actual.setIntegrityTokenProvider>
        ) => {
            mockSetIntegrityTokenProvider(...args)
            return actual.setIntegrityTokenProvider(...args)
        },
    }
})

vi.mock('@perawallet/wallet-extension-platform-chrome', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-extension-platform-chrome')
    >('@perawallet/wallet-extension-platform-chrome')
    return {
        ...actual,
        signChallenge: mockSignChallenge,
        exportInstallPublicKey: mockExportPublicKey,
        ensureDeviceInstallationID: async () => 'install-1',
        // Real implementations touch IndexedDB / chrome.storage internals this
        // suite doesn't otherwise exercise — mocked so the 403 tests can assert
        // on call counts directly instead of inspecting storage side effects.
        clearInstallKey: mockClearInstallKey,
        clearSessionIntegrityToken: mockClearSessionIntegrityToken,
    }
})

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-config')
    >('@perawallet/wallet-core-config')
    return {
        ...actual,
        config: { ...actual.config, webIntegrityMintEnabled: true },
    }
})

const NOW = Date.parse('2026-08-04T12:00:00.000Z')

// vi.doMock isn't scoped to one test — it persists for every subsequent
// dynamic import in the file until something re-registers the factory.
// withMintFlagOff wraps the only two tests that need it off in a
// try/finally, so the leak can never reach whatever test runs next. (A
// file-level afterEach re-registering it after all 24 tests instead of just
// these 2 was tried first — it measurably increased how often an unrelated
// vitest mock-timing race fired elsewhere in this file, so restoring only at
// the two actual call sites is the version that stayed here.)
const mockMintFlag = (enabled: boolean): void => {
    vi.doMock('@perawallet/wallet-core-config', async () => {
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-config')
        >('@perawallet/wallet-core-config')
        return {
            ...actual,
            config: { ...actual.config, webIntegrityMintEnabled: enabled },
        }
    })
}

const withMintFlagOff = async (fn: () => Promise<void>): Promise<void> => {
    mockMintFlag(false)
    try {
        await fn()
    } finally {
        mockMintFlag(true)
    }
}

describe('ensureIntegrityToken', () => {
    let fake: LocalChromeFake

    beforeAll(() => {
        vi.useFakeTimers()
    })

    afterAll(() => {
        vi.useRealTimers()
    })

    beforeEach(async () => {
        vi.clearAllMocks()
        vi.resetModules()
        vi.setSystemTime(NOW)
        fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
        mockRequestChallenge.mockResolvedValue('challenge-value')
        mockSignChallenge.mockResolvedValue('sig-base64')
        mockExportPublicKey.mockResolvedValue('spki-base64')
        mockAttestDevice.mockResolvedValue({
            integrityToken: 'jwt-value',
            expiresAt: new Date(NOW + 15 * 60 * 1000).toISOString(),
        })
    })

    it('mints and persists a token when none exists', async () => {
        const { ensureIntegrityToken } = await import('../integrity')
        const { getSessionIntegrityToken } =
            await import('@perawallet/wallet-extension-platform-chrome')

        await ensureIntegrityToken()

        expect(mockAttestDevice).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: {
                    deviceInstallationId: 'install-1',
                    platform: 'web',
                    publicKey: 'spki-base64',
                    signature: 'sig-base64',
                },
            }),
        )
        const stored = await getSessionIntegrityToken()
        expect(stored?.integrityToken).toBe('jwt-value')
        expect(stored?.mintedAt).toBe(new Date(NOW).toISOString())
    })

    it('does nothing when a fresh token is already present', async () => {
        const { ensureIntegrityToken } = await import('../integrity')
        await ensureIntegrityToken()
        mockAttestDevice.mockClear()

        await ensureIntegrityToken()

        expect(mockAttestDevice).not.toHaveBeenCalled()
    })

    it('re-mints once the token passes 60% of its lifetime', async () => {
        const { ensureIntegrityToken } = await import('../integrity')
        await ensureIntegrityToken()
        mockAttestDevice.mockClear()

        // 15-minute TTL, refresh threshold at 9 minutes.
        vi.setSystemTime(NOW + 10 * 60 * 1000)
        await ensureIntegrityToken()

        expect(mockAttestDevice).toHaveBeenCalledTimes(1)
    })

    it('is single-flight under concurrent callers', async () => {
        const { ensureIntegrityToken } = await import('../integrity')

        await Promise.all([
            ensureIntegrityToken(),
            ensureIntegrityToken(),
            ensureIntegrityToken(),
        ])

        expect(mockAttestDevice).toHaveBeenCalledTimes(1)
    })

    // The default succeeding mock above can't reach this path: single-flight
    // alone only proves the freshness re-check works. This proves the backoff
    // gate is ALSO re-checked inside the lock, so a caller queued behind a
    // failing mint doesn't fire its own doomed attempt once it's their turn.
    it('does not let a queued caller retry a still-active backoff set by a concurrent failure', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')

        await Promise.all([
            ensureIntegrityToken(),
            ensureIntegrityToken(),
            ensureIntegrityToken(),
        ])

        expect(mockAttestDevice).toHaveBeenCalledTimes(1)
    })

    it('does not throw when minting fails', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')

        await expect(ensureIntegrityToken()).resolves.toBeUndefined()
    })

    it('backs off after a failure instead of retrying immediately', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')

        await ensureIntegrityToken()
        mockAttestDevice.mockClear()
        await ensureIntegrityToken()

        // A permanently-4xx backend is the EXPECTED steady state of this step;
        // without backoff every install would attempt a doomed mint per tick.
        expect(mockAttestDevice).not.toHaveBeenCalled()
    })

    it('retries once the backoff window elapses', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')
        await ensureIntegrityToken()
        mockAttestDevice.mockClear()

        vi.setSystemTime(NOW + 6 * 60 * 1000)
        await ensureIntegrityToken()

        expect(mockAttestDevice).toHaveBeenCalledTimes(1)
    })

    it('clears the install key and session token on a 403 (revoked) failure', async () => {
        mockAttestDevice.mockRejectedValue(
            Object.assign(new Error('revoked'), { status: 403 }),
        )
        const { ensureIntegrityToken } = await import('../integrity')

        await ensureIntegrityToken()

        expect(mockClearInstallKey).toHaveBeenCalledTimes(1)
        expect(mockClearSessionIntegrityToken).toHaveBeenCalledTimes(1)
    })

    // Companion to the 403 case above: without this, a regression that fires
    // the clears on ANY failure (rather than only a 403) would pass both
    // tests, since the 403 test alone can't tell "cleared because 403" apart
    // from "cleared unconditionally".
    it('does not clear identity on a non-403 failure', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')

        await ensureIntegrityToken()

        expect(mockClearInstallKey).not.toHaveBeenCalled()
        expect(mockClearSessionIntegrityToken).not.toHaveBeenCalled()
    })

    it('clears backoff state once a mint succeeds after a prior failure', async () => {
        mockAttestDevice.mockRejectedValueOnce(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')
        const { INTEGRITY_BACKOFF_SESSION_KEY } =
            await import('@perawallet/wallet-extension-platform-chrome')

        await ensureIntegrityToken()
        expect(fake.session.get(INTEGRITY_BACKOFF_SESSION_KEY)).toBeDefined()

        // Past the 5-minute floor set by the failure above; attestDevice now
        // resolves (the mockRejectedValueOnce above was already consumed).
        vi.setSystemTime(NOW + 6 * 60 * 1000)
        await ensureIntegrityToken()

        expect(fake.session.get(INTEGRITY_BACKOFF_SESSION_KEY)).toBeUndefined()
    })

    it('caps the backoff delay at 60 minutes after enough consecutive failures', async () => {
        mockAttestDevice.mockRejectedValue(
            new Error('backend has no web branch'),
        )
        const { ensureIntegrityToken } = await import('../integrity')
        const { INTEGRITY_BACKOFF_SESSION_KEY } =
            await import('@perawallet/wallet-extension-platform-chrome')

        // Delays double each time (5, 10, 20, 40min); the 5th failure would be
        // 80min uncapped — this only proves the clamp if driven far enough.
        let now = NOW
        for (let i = 0; i < 4; i += 1) {
            // oxlint-disable-next-line no-await-in-loop -- each iteration must
            // observe the previous failure's persisted nextAttemptAt.
            await ensureIntegrityToken()
            const state = fake.session.get(INTEGRITY_BACKOFF_SESSION_KEY) as {
                nextAttemptAt: number
            }
            now = state.nextAttemptAt
            vi.setSystemTime(now)
        }

        await ensureIntegrityToken()
        const state = fake.session.get(INTEGRITY_BACKOFF_SESSION_KEY) as {
            failures: number
            nextAttemptAt: number
        }

        expect(state.failures).toBe(5)
        expect(state.nextAttemptAt - now).toBe(60 * 60 * 1000)
    })

    it('does nothing at all when the mint flag is off', async () =>
        withMintFlagOff(async () => {
            vi.resetModules()
            const { ensureIntegrityToken } = await import('../integrity')

            await ensureIntegrityToken()

            expect(mockRequestChallenge).not.toHaveBeenCalled()
        }))
})

describe('installIntegrityRenewal', () => {
    let fake: LocalChromeFake

    beforeAll(() => {
        vi.useFakeTimers()
    })

    afterAll(() => {
        vi.useRealTimers()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        vi.setSystemTime(NOW)
        fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
        mockRequestChallenge.mockResolvedValue('challenge-value')
        mockSignChallenge.mockResolvedValue('sig-base64')
        mockExportPublicKey.mockResolvedValue('spki-base64')
        mockAttestDevice.mockResolvedValue({
            integrityToken: 'jwt-value',
            expiresAt: new Date(NOW + 15 * 60 * 1000).toISOString(),
        })
    })

    it('arms the renewal alarm', async () => {
        const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        installIntegrityRenewal()
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )

        expect(fake.alarms.get(INTEGRITY_RENEW_ALARM)).toEqual({
            periodInMinutes: 5,
        })

        // installIntegrityRenewal also fires an opportunistic mint as a
        // second, independent fire-and-forget chain — draining it before
        // this test returns keeps its trailing chrome.* calls off whatever
        // fake the next test's beforeEach installs.
        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
    })

    it('registers a token provider synchronously, before any mint completes', async () => {
        const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        installIntegrityRenewal()

        // The spy assertion is what makes this falsifiable — a missing or
        // deferred registration would leave the count at 0, whereas
        // readIntegrityToken() reads null either way (registered-but-empty
        // and never-registered are indistinguishable through it alone).
        // Registered synchronously at install time so a request on an early
        // wake is not silently unauthenticated. installIntegrityRenewal also
        // fires an opportunistic mint, but that mint's first await hasn't
        // yielded yet at this point in the microtask queue.
        expect(mockSetIntegrityTokenProvider).toHaveBeenCalledTimes(1)
        expect(readIntegrityToken()).toBeNull()

        // Drain BOTH of installIntegrityRenewal's fire-and-forget chains —
        // the alarm-arm and the opportunistic mint are independent, so
        // waiting on only one leaves the other free to run a stray chrome.*
        // call against the NEXT test's fresh fake once its beforeEach
        // reassigns globalThis.chrome.
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )
        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
    })

    it('registers the provider even when the mint flag is off', async () =>
        withMintFlagOff(async () => {
            vi.resetModules()
            const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
                await import('../integrity')

            installIntegrityRenewal()

            expect(mockSetIntegrityTokenProvider).toHaveBeenCalledTimes(1)
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(false)
        }))

    it('mints on the alarm tick', async () => {
        const { handleIntegrityAlarm, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')

        await handleIntegrityAlarm({
            name: INTEGRITY_RENEW_ALARM,
        } as chrome.alarms.Alarm)

        expect(mockAttestDevice).toHaveBeenCalledTimes(1)
    })

    it('ignores alarms it does not own', async () => {
        const { handleIntegrityAlarm } = await import('../integrity')

        await handleIntegrityAlarm({
            name: 'pera-wc-heartbeat',
        } as chrome.alarms.Alarm)

        expect(mockAttestDevice).not.toHaveBeenCalled()
    })
})

describe('the module-scoped token cache backing the provider', () => {
    let fake: LocalChromeFake

    beforeAll(() => {
        vi.useFakeTimers()
    })

    afterAll(() => {
        vi.useRealTimers()
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
        vi.setSystemTime(NOW)
        fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
        mockRequestChallenge.mockResolvedValue('challenge-value')
        mockSignChallenge.mockResolvedValue('sig-base64')
        mockExportPublicKey.mockResolvedValue('spki-base64')
        mockAttestDevice.mockResolvedValue({
            integrityToken: 'jwt-value',
            expiresAt: new Date(NOW + 15 * 60 * 1000).toISOString(),
        })
    })

    it('returns null before any mint has happened', async () => {
        const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        installIntegrityRenewal()

        expect(readIntegrityToken()).toBeNull()

        // Drain installIntegrityRenewal's fire-and-forget chains before
        // returning — see the identical comment in the installIntegrityRenewal
        // describe above for why a straggler here can corrupt a later test.
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )
        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
    })

    it('returns the token once a mint succeeds', async () => {
        const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        // installIntegrityRenewal's own fire-and-forget ensureIntegrityToken()
        // is the only mint triggered here. Awaiting via polling — rather than
        // a second, explicit ensureIntegrityToken() call — keeps this test
        // isolated to mint()'s own cache write: a second call would also pass
        // through ensureIntegrityToken's "seed cachedToken from the read-back
        // storage value" line and mask a missing write inside mint() itself.
        installIntegrityRenewal()

        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
        // Also drain the independent alarm-arm chain — see the identical
        // comment in the installIntegrityRenewal describe above.
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )
    })

    it('returns null once the cached token has expired', async () => {
        const { installIntegrityRenewal, INTEGRITY_RENEW_ALARM } =
            await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        installIntegrityRenewal()
        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )

        // Past the mocked token's expiresAt (NOW + 15min); no further mint is
        // triggered here, so this isolates the provider's own freshness check
        // from ensureIntegrityToken's re-mint logic.
        vi.setSystemTime(NOW + 16 * 60 * 1000)

        expect(readIntegrityToken()).toBeNull()
    })

    it('drops the cached token on a 403 (revoked) re-mint failure', async () => {
        const {
            installIntegrityRenewal,
            ensureIntegrityToken,
            INTEGRITY_RENEW_ALARM,
        } = await import('../integrity')
        const { readIntegrityToken } =
            await import('@perawallet/wallet-core-shared')

        installIntegrityRenewal()
        await vi.waitFor(() => expect(readIntegrityToken()).toBe('jwt-value'))
        await vi.waitFor(() =>
            expect(fake.alarms.has(INTEGRITY_RENEW_ALARM)).toBe(true),
        )

        // Past the 60% refresh threshold (15-minute TTL) so the next
        // ensureIntegrityToken call re-reads the still-cached token as
        // "existing" — the exact path that re-warms cachedToken from storage
        // before the revoked re-mint fails — rather than expiring it away and
        // masking the bug this test exists to catch.
        vi.setSystemTime(NOW + 10 * 60 * 1000)
        mockAttestDevice.mockRejectedValueOnce(
            Object.assign(new Error('revoked'), { status: 403 }),
        )

        await ensureIntegrityToken()

        expect(readIntegrityToken()).toBeNull()
    })
})

describe('isIntegrityTokenStale', () => {
    beforeEach(() => {
        vi.resetModules()
        globalThis.chrome = createLocalChromeFake().chrome
    })

    // Unparseable dates must read as stale, not fresh — the opposite reading
    // would wedge a permanently-stale-looking token as permanently fresh.
    it('treats an unparseable mintedAt as stale', async () => {
        const { isIntegrityTokenStale } = await import('../integrity')

        expect(
            isIntegrityTokenStale(
                {
                    integrityToken: 'jwt',
                    expiresAt: new Date(NOW + 15 * 60 * 1000).toISOString(),
                    mintedAt: 'not-a-date',
                    deviceInstallationId: 'install-1',
                },
                NOW,
            ),
        ).toBe(true)
    })

    it('treats an unparseable expiresAt as stale', async () => {
        const { isIntegrityTokenStale } = await import('../integrity')

        expect(
            isIntegrityTokenStale(
                {
                    integrityToken: 'jwt',
                    expiresAt: 'not-a-date',
                    mintedAt: new Date(NOW).toISOString(),
                    deviceInstallationId: 'install-1',
                },
                NOW,
            ),
        ).toBe(true)
    })
})
