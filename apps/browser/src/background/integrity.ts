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
    isConnectivityError,
    isPeraNetworkError,
    logger,
    setIntegrityTokenProvider,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    ensureDeviceInstallationID,
    isTrustedExtensionPageSender,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    INTEGRITY_BACKOFF_SESSION_KEY,
    INTEGRITY_REVOCATIONS_SESSION_KEY,
    clearEnrolmentMarker,
    clearInstallKey,
    clearSessionIntegrityToken,
    exportInstallPublicKey,
    getEnrolmentMarker,
    getInstallKeyId,
    getSessionIntegrityToken,
    putSessionIntegrityToken,
    parseIntegrityControlMessage,
    signChallenge,
    type SessionIntegrityToken,
} from '@perawallet/wallet-core-browser-runtime'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import {
    enrolBackoff,
    isEnrolmentNeeded,
    markEnrolmentNeeded,
} from './enrol-attempt'
import {
    clearLastFailure,
    readLastAnsweredFailureAt,
    recordLastFailure,
} from './integrity-failure'
import { createSessionBackoff } from './session-backoff'
import { withNamedLock } from './named-lock'
import { readActiveDeployment } from './network'

export const INTEGRITY_RENEW_ALARM = 'pera-integrity-renew'

// Chrome clamps alarm periods to 1 minute minimum for packed extensions. Five
// is the cheapest cadence that still refreshes a 15-minute token well before
// its 60% threshold.
export const INTEGRITY_RENEW_PERIOD_MINUTES = 5

const REFRESH_AT_FRACTION = 0.6
const BACKOFF_FLOOR_MS = 5 * 60 * 1000
const BACKOFF_CAP_MS = 60 * 60 * 1000
// A renewal starts at 9 of 15 minutes; with the usual 5-minute floor one
// failed renewal could outlive the token it was renewing.
const BACKOFF_FLOOR_WHILE_TOKEN_LIVES_MS = 60 * 1000
const REVOCATIONS_BEFORE_BLOCKED = 2
const RETRY_COOLDOWN_MS = 30 * 1000
const SOFT_RETRY_QUIET_MS = 60 * 1000

const mintBackoff = createSessionBackoff({
    key: INTEGRITY_BACKOFF_SESSION_KEY,
    floorMs: BACKOFF_FLOOR_MS,
    capMs: BACKOFF_CAP_MS,
})

// This realm's own view of the token — the SW can't use useAppIntegrityStore
// (see packages/app-integrity/src/api.ts for why). Seeded from
// chrome.storage.session on every read, written on every successful mint.
let cachedToken: Nullable<SessionIntegrityToken> = null

const readCachedIntegrityToken = (): Nullable<string> => {
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

const mint = async (deployment: WalletMode): Promise<void> => {
    const deviceInstallationId = await ensureDeviceInstallationID()

    const challenge = await requestChallenge({
        deviceInstallationId,
        platform: 'web',
        deployment,
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
        deployment,
    })

    await putSessionIntegrityToken({
        integrityToken,
        expiresAt,
        mintedAt,
        deviceInstallationId,
    })
    cachedToken = { integrityToken, expiresAt, mintedAt, deviceInstallationId }
    await mintBackoff.clear()
    await clearLastFailure('mint')
}

const isMarkedEnrolled = async (deployment: WalletMode): Promise<boolean> => {
    const [marker, kid] = await Promise.all([
        getEnrolmentMarker(deployment),
        getInstallKeyId(),
    ])
    return marker?.kid === kid
}

const isForbidden = (error: unknown): boolean =>
    (error as Nullable<{ status?: number }>)?.status === 403

// No answer at all: the network, not the backend. Retrying costs nothing, so
// such a failure must not cost the user five minutes of backoff.
const isTransportFailure = (error: unknown): boolean =>
    isConnectivityError(error) ||
    (isPeraNetworkError(error) && error.kind === 'timeout')

const statusOf = (error: unknown): Optional<number> => {
    const status = (error as Nullable<{ status?: unknown }>)?.status
    return typeof status === 'number' ? status : undefined
}

const isTokenAlive = (token: Nullable<SessionIntegrityToken>): boolean => {
    if (!token) return false
    const expiresAt = Date.parse(token.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

// The contract lets a revoked device re-enrol with a fresh key; a backend that
// revokes by device would meet a fresh solve on every page open without this.
const countRevocation = async (): Promise<void> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_REVOCATIONS_SESSION_KEY,
    )
    const previous = stored[INTEGRITY_REVOCATIONS_SESSION_KEY]
    const count = (typeof previous === 'number' ? previous : 0) + 1
    await chrome.storage.session.set({
        [INTEGRITY_REVOCATIONS_SESSION_KEY]: count,
    })
    if (count >= REVOCATIONS_BEFORE_BLOCKED) await enrolBackoff.exhaust()
}

// Only an enrolled token stands in for the API key, so a token minted while
// enrolment is still to do would only be refused. Without enrolment there is
// no other kind of token, so the hold applies only where enrolment runs.
const isMintHeld = async (): Promise<boolean> =>
    (await mintBackoff.isBlocked()) ||
    (config.webIntegrityEnrolEnabled && (await isEnrolmentNeeded()))

// The claim is read, never trusted: it only decides how a refusal is taken.
// An unreadable token keeps the stricter reading, an outage.
const isEnrolledToken = (integrityToken: string): boolean => {
    try {
        const payload = integrityToken.split('.')[1]
        if (!payload) return true
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        return (JSON.parse(json) as { enr?: unknown }).enr === true
    } catch {
        return true
    }
}

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

        if (await isMintHeld()) return

        await withNamedLock('pera-integrity-mint', async () => {
            // Re-check both gates inside the lock: another realm (or a
            // queued waiter in the in-memory fallback) may have minted, or
            // just recorded a failure, while this caller waited its turn.
            const fresh = await getSessionIntegrityToken()
            if (fresh) cachedToken = fresh
            if (fresh && !isIntegrityTokenStale(fresh, Date.now())) return

            if (await isMintHeld()) return

            const deployment = await readActiveDeployment()
            try {
                await mint(deployment)
            } catch (error) {
                const code = readIntegrityErrorCode(error)
                const isTransport = isTransportFailure(error)
                await recordLastFailure({
                    phase: 'mint',
                    isTransport,
                    ...(code ? { code } : {}),
                    ...(statusOf(error) !== undefined
                        ? { status: statusOf(error) }
                        : {}),
                })
                if (isTransport) {
                    logger.warn('Web integrity mint got no answer', { error })
                    return
                }
                if (isForbidden(error)) {
                    if (code === 'APP_INTEGRITY_ENROLMENT_REQUIRED') {
                        // The key is sound; this backend just has no enrolment for it. A marker
                        // for this key means the backend contradicts us (replica lag, a defect),
                        // so enrolment backs off rather than re-enrolling on the next page.
                        if (await isMarkedEnrolled(deployment)) {
                            await enrolBackoff.recordFailure()
                        }
                        await clearEnrolmentMarker(deployment)
                        await markEnrolmentNeeded()
                    } else {
                        await clearInstallKey()
                        await clearSessionIntegrityToken()
                        // The read above may have warmed this from the rejected token.
                        cachedToken = null
                        // A new key has no enrolment anywhere, so the old marker is dead by
                        // its kid and needs no clearing.
                        if (code === 'APP_INTEGRITY_REVOKED') {
                            await countRevocation()
                            await markEnrolmentNeeded()
                        }
                    }
                }
                await mintBackoff.recordFailure(
                    isTokenAlive(fresh)
                        ? { floorMs: BACKOFF_FLOOR_WHILE_TOKEN_LIVES_MS }
                        : undefined,
                )
                logger.warn('Web integrity mint failed', {
                    code,
                    status: statusOf(error),
                    error,
                })
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

// A token minted before enrolment never carries it, however long it has left.
export const replaceTokenAfterEnrolment = async (): Promise<void> => {
    await clearSessionIntegrityToken()
    cachedToken = null
    await resumeIntegrityMint()
}

let lastRetryAt = 0
let lastRejectedToken: Nullable<string> = null

// An enrolled token the backend refuses within this long of issuing it was not
// stale: it is the backend's answer (bearer acceptance off), and minting again
// would only feed the refetch of everything that failed with it.
const FRESH_TOKEN_MS = 60 * 1000

const isNamedToken = (
    token: SessionIntegrityToken,
    tokenExpiresAt: Nullable<number>,
): boolean =>
    tokenExpiresAt === null ||
    Math.floor(Date.parse(token.expiresAt) / 1000) ===
        Math.floor(tokenExpiresAt / 1000)

// The UI saw a guarded request refused while it held a token (clock skew, a
// revocation the token predates). Once per token, and only the token it names:
// refusals of one already replaced must not take its successor down.
const replaceRejectedToken = async (
    tokenExpiresAt: Nullable<number>,
): Promise<void> => {
    const current = await getSessionIntegrityToken()
    if (!current) {
        await ensureIntegrityToken()
        return
    }
    if (!isNamedToken(current, tokenExpiresAt)) return
    if (current.integrityToken === lastRejectedToken) return
    lastRejectedToken = current.integrityToken
    await clearSessionIntegrityToken()
    cachedToken = null
    // An unenrolled token is refused by design, so the refusal says enrolment is
    // still to do (the welcome screen defers it), never that Pera is down.
    if (
        config.webIntegrityEnrolEnabled &&
        !isEnrolledToken(current.integrityToken)
    ) {
        if (await isMarkedEnrolled(await readActiveDeployment())) {
            await ensureIntegrityToken()
            return
        }
        await markEnrolmentNeeded()
        logger.info('Web integrity token refused before enrolment')
        return
    }
    if (Date.now() - Date.parse(current.mintedAt) < FRESH_TOKEN_MS) {
        await recordLastFailure({
            phase: 'mint',
            status: 401,
            isTransport: false,
        })
        await mintBackoff.recordFailure()
        logger.warn('Web integrity token refused as soon as it was minted')
        return
    }
    await ensureIntegrityToken()
}

/** Acts on a control message from the UI realm. Never throws. */
export const handleIntegrityControl = async (
    message: unknown,
): Promise<void> => {
    const control = parseIntegrityControlMessage(message)
    if (!control || !config.webIntegrityMintEnabled) return
    try {
        if (control.kind === 'token-rejected') {
            await replaceRejectedToken(control.tokenExpiresAt)
            return
        }
        const now = Date.now()
        // Automatic retries (page open, back online) answer only to the quiet
        // rule, so one never spends the cooldown that guards the user's Retry.
        if (control.soft) {
            const lastFailureAt = await readLastAnsweredFailureAt()
            if (
                lastFailureAt !== null &&
                now - lastFailureAt < SOFT_RETRY_QUIET_MS
            ) {
                return
            }
        } else {
            if (now - lastRetryAt < RETRY_COOLDOWN_MS) return
            lastRetryAt = now
        }
        await resumeIntegrityMint()
    } catch (error) {
        logger.warn('Web integrity control failed', {
            error,
            kind: control.kind,
        })
    }
}

// Top level in the worker entry, beside the enrolment route. Content scripts
// share onMessage; only extension pages may steer the mint loop.
export const installIntegrityControlRoute = ({
    chromeLike = chrome,
}: { chromeLike?: typeof chrome } = {}): void => {
    chromeLike.runtime.onMessage.addListener((message, sender) => {
        if (!parseIntegrityControlMessage(message)) return false
        if (!isTrustedExtensionPageSender(sender, chromeLike)) return false
        void handleIntegrityControl(message)
        return false
    })
}
