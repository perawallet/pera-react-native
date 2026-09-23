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
    readIntegrityErrorCode,
    requestChallenge,
} from '@perawallet/wallet-core-app-integrity/api'
import { config } from '@perawallet/wallet-core-config'
import {
    logger,
    setIntegrityTokenProvider,
} from '@perawallet/wallet-core-shared'
import {
    INTEGRITY_BACKOFF_SESSION_KEY,
    clearEnrolmentMarker,
    clearInstallKey,
    clearSessionIntegrityToken,
    ensureDeviceInstallationID,
    exportInstallPublicKey,
    getEnrolmentMarker,
    getInstallKeyId,
    getSessionIntegrityToken,
    putSessionIntegrityToken,
    signChallenge,
    type SessionIntegrityToken,
} from '@perawallet/wallet-extension-platform-chrome'
import { enrolBackoff, markEnrolmentNeeded } from './enrol-attempt'
import { createSessionBackoff } from './session-backoff'
import { withNamedLock } from './named-lock'
import { readActiveNetwork, type ActiveNetwork } from './network'

export const INTEGRITY_RENEW_ALARM = 'pera-integrity-renew'

// Chrome clamps alarm periods to 1 minute minimum for packed extensions. Five
// is the cheapest cadence that still refreshes a 15-minute token well before
// its 60% threshold.
export const INTEGRITY_RENEW_PERIOD_MINUTES = 5

const REFRESH_AT_FRACTION = 0.6
const BACKOFF_FLOOR_MS = 5 * 60 * 1000
const BACKOFF_CAP_MS = 60 * 60 * 1000

const mintBackoff = createSessionBackoff({
    key: INTEGRITY_BACKOFF_SESSION_KEY,
    floorMs: BACKOFF_FLOOR_MS,
    capMs: BACKOFF_CAP_MS,
})

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

const mint = async (network: ActiveNetwork): Promise<void> => {
    const deviceInstallationId = await ensureDeviceInstallationID()

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
    await mintBackoff.clear()
}

const isMarkedEnrolled = async (network: ActiveNetwork): Promise<boolean> => {
    const [marker, kid] = await Promise.all([
        getEnrolmentMarker(network),
        getInstallKeyId(),
    ])
    return marker?.kid === kid
}

const isForbidden = (error: unknown): boolean =>
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

        if (await mintBackoff.isBlocked()) return

        await withNamedLock('pera-integrity-mint', async () => {
            // Re-check both gates inside the lock: another realm (or a
            // queued waiter in the in-memory fallback) may have minted, or
            // just recorded a failure, while this caller waited its turn.
            const fresh = await getSessionIntegrityToken()
            if (fresh) cachedToken = fresh
            if (fresh && !isIntegrityTokenStale(fresh, Date.now())) return

            if (await mintBackoff.isBlocked()) return

            const network = await readActiveNetwork()
            try {
                await mint(network)
            } catch (error) {
                if (isForbidden(error)) {
                    const code = readIntegrityErrorCode(error)
                    if (code === 'APP_INTEGRITY_ENROLMENT_REQUIRED') {
                        // The key is sound; this backend just has no enrolment for it. A marker
                        // for this key means the backend contradicts us (replica lag, a defect),
                        // so enrolment backs off rather than re-enrolling on the next page.
                        if (await isMarkedEnrolled(network)) {
                            await enrolBackoff.recordFailure()
                        }
                        await clearEnrolmentMarker(network)
                        await markEnrolmentNeeded()
                    } else {
                        await clearInstallKey()
                        await clearSessionIntegrityToken()
                        // The read above may have warmed this from the rejected token.
                        cachedToken = null
                        // A new key has no enrolment anywhere, so the old marker is dead by
                        // its kid and needs no clearing.
                        if (code === 'APP_INTEGRITY_REVOKED')
                            await markEnrolmentNeeded()
                    }
                }
                await mintBackoff.recordFailure()
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

/**
 * Clears the mint backoff and mints now. Enrolment calls this when it
 * succeeds: under enforcement the mint that asked for enrolment backed off, and
 * waiting that out would leave the install without a token for up to an hour.
 */
export const resumeIntegrityMint = async (): Promise<void> => {
    await mintBackoff.clear()
    await ensureIntegrityToken()
}
