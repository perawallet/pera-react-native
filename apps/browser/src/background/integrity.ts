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

// The /api subpath, never the package root — see the comment in
// packages/app-integrity/src/api.ts for why.
import {
    attestDevice,
    requestChallenge,
} from '@perawallet/wallet-core-app-integrity/api'
import { config } from '@perawallet/wallet-core-config'
import {
    logger,
    setIntegrityTokenProvider,
} from '@perawallet/wallet-core-shared'
import {
    INTEGRITY_BACKOFF_SESSION_KEY,
    clearInstallKey,
    clearSessionIntegrityToken,
    ensureDeviceInstallationID,
    exportInstallPublicKey,
    getSessionIntegrityToken,
    putSessionIntegrityToken,
    signChallenge,
    type SessionIntegrityToken,
} from '@perawallet/wallet-extension-platform-chrome'
import { parseActiveNetwork, type ActiveNetwork } from './network'

export const INTEGRITY_RENEW_ALARM = 'pera-integrity-renew'

// Chrome clamps alarm periods to 1 minute minimum for packed extensions. Five
// is the cheapest cadence that still refreshes a 15-minute token well before
// its 60% threshold.
export const INTEGRITY_RENEW_PERIOD_MINUTES = 5

const REFRESH_AT_FRACTION = 0.6
const BACKOFF_FLOOR_MS = 5 * 60 * 1000
const BACKOFF_CAP_MS = 60 * 60 * 1000

// background/index.ts's resolveActiveNetwork reads this same literal (there's
// no shared export for it — the store persists it directly, see network.ts).
const NETWORK_STORAGE_KEY = 'kv:network-store'

type BackoffState = { failures: number; nextAttemptAt: number }

// This realm's own view of the token — the SW can't use useAppIntegrityStore
// (see packages/app-integrity/src/api.ts for why). Seeded from
// chrome.storage.session on every read, written on every successful mint.
let cachedToken: SessionIntegrityToken | null = null

const readCachedIntegrityToken = (): string | null => {
    if (!cachedToken) return null
    const expiry = Date.parse(cachedToken.expiresAt)
    return Number.isFinite(expiry) && expiry > Date.now()
        ? cachedToken.integrityToken
        : null
}

export const isIntegrityTokenStale = (
    token: SessionIntegrityToken,
    now: number,
): boolean => {
    const mintedAt = Date.parse(token.mintedAt)
    const expiresAt = Date.parse(token.expiresAt)
    if (!Number.isFinite(mintedAt) || !Number.isFinite(expiresAt)) return true
    return now >= mintedAt + (expiresAt - mintedAt) * REFRESH_AT_FRACTION
}

const readBackoff = async (): Promise<BackoffState> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_BACKOFF_SESSION_KEY,
    )
    const value = stored[INTEGRITY_BACKOFF_SESSION_KEY] as
        | Partial<BackoffState>
        | undefined
    return {
        failures: typeof value?.failures === 'number' ? value.failures : 0,
        nextAttemptAt:
            typeof value?.nextAttemptAt === 'number' ? value.nextAttemptAt : 0,
    }
}

const recordFailure = async (): Promise<void> => {
    const { failures } = await readBackoff()
    const next = failures + 1
    const delay = Math.min(BACKOFF_FLOOR_MS * 2 ** (next - 1), BACKOFF_CAP_MS)
    await chrome.storage.session.set({
        [INTEGRITY_BACKOFF_SESSION_KEY]: {
            failures: next,
            nextAttemptAt: Date.now() + delay,
        },
    })
}

const clearBackoff = async (): Promise<void> => {
    await chrome.storage.session.remove(INTEGRITY_BACKOFF_SESSION_KEY)
}

// jsdom has no navigator.locks, so a bare fallback would silently drop
// serialization under test. This FIFO queue backs it with a real same-realm
// mutex: each waiter chains onto the previous holder's completion.
let mutexQueue: Promise<void> = Promise.resolve()

const withMintLock = async (fn: () => Promise<void>): Promise<void> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request('pera-integrity-mint', fn)
        return
    }
    const previous = mutexQueue
    let release = (): void => {}
    mutexQueue = new Promise<void>(resolve => {
        release = resolve
    })
    await previous
    try {
        await fn()
    } finally {
        release()
    }
}

const resolveNetwork = async (): Promise<ActiveNetwork> => {
    const stored = await chrome.storage.local.get(NETWORK_STORAGE_KEY)
    const raw = stored[NETWORK_STORAGE_KEY]
    return parseActiveNetwork(typeof raw === 'string' ? raw : undefined)
}

const mint = async (): Promise<void> => {
    const deviceInstallationId = await ensureDeviceInstallationID()
    const network = await resolveNetwork()

    const challenge = await requestChallenge({
        deviceInstallationId,
        platform: 'web',
        network,
    })
    const [publicKey, signature] = await Promise.all([
        exportInstallPublicKey(),
        signChallenge(challenge),
    ])

    const mintedAt = new Date().toISOString()
    const { integrityToken, expiresAt } = await attestDevice({
        payload: {
            deviceInstallationId,
            platform: 'web',
            publicKey,
            signature,
        },
        network,
    })

    await putSessionIntegrityToken({
        integrityToken,
        expiresAt,
        mintedAt,
        deviceInstallationId,
    })
    cachedToken = { integrityToken, expiresAt, mintedAt, deviceInstallationId }
    await clearBackoff()
}

const isRevoked = (error: unknown): boolean =>
    (error as { status?: number } | null)?.status === 403

/**
 * Ensures a warm integrity token exists, minting or renewing if not. Safe to
 * call from any service-worker wake path — concurrent callers collapse to one
 * mint, and every failure path is swallowed. Never throws.
 */
export const ensureIntegrityToken = async (): Promise<void> => {
    if (!config.webIntegrityMintEnabled) return

    try {
        const existing = await getSessionIntegrityToken()
        if (existing) cachedToken = existing
        if (existing && !isIntegrityTokenStale(existing, Date.now())) return

        const backoff = await readBackoff()
        if (backoff.nextAttemptAt > Date.now()) return

        await withMintLock(async () => {
            // Re-check both gates inside the lock: another realm (or a
            // queued waiter in the in-memory fallback) may have minted, or
            // just recorded a failure, while this caller waited its turn.
            const fresh = await getSessionIntegrityToken()
            if (fresh) cachedToken = fresh
            if (fresh && !isIntegrityTokenStale(fresh, Date.now())) return

            const innerBackoff = await readBackoff()
            if (innerBackoff.nextAttemptAt > Date.now()) return

            try {
                await mint()
            } catch (error) {
                if (isRevoked(error)) {
                    // Enrolment is a later step, so there is nothing to re-run
                    // yet — drop the identity so the next attempt starts clean.
                    await clearInstallKey()
                    await clearSessionIntegrityToken()
                    // The existing/fresh read above may have already warmed
                    // this from the now-revoked stored token — expiry alone
                    // won't catch a revocation, so drop it explicitly too.
                    cachedToken = null
                }
                await recordFailure()
                logger.warn('Web integrity mint failed', { error })
            }
        })
    } catch (error) {
        // Fail open: no caller of this function may ever see a rejection.
        logger.warn('Web integrity ensure failed', { error })
    }
}

export const handleIntegrityAlarm = async (
    alarm: chrome.alarms.Alarm,
): Promise<void> => {
    if (alarm.name !== INTEGRITY_RENEW_ALARM) return
    await ensureIntegrityToken()
}

// Top-level like installPushHandlers, so a woken worker already has its
// listener and provider live. Registration always runs — a disabled flag
// must still answer null rather than leave the provider unset; only
// arming the alarm is gated.
export const installIntegrityRenewal = (): void => {
    setIntegrityTokenProvider(readCachedIntegrityToken)

    if (!config.webIntegrityMintEnabled) return

    void (async () => {
        try {
            await chrome.alarms.create(INTEGRITY_RENEW_ALARM, {
                periodInMinutes: INTEGRITY_RENEW_PERIOD_MINUTES,
            })
        } catch (error) {
            logger.warn('Arming the integrity renewal alarm failed', {
                error,
            })
        }
    })()

    void ensureIntegrityToken()
}
