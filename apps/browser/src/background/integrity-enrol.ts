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
    enrolDevice,
    readIntegrityErrorCode,
} from '@perawallet/wallet-core-app-integrity/api'
import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import {
    INTEGRITY_CHECK_PATH,
    INTEGRITY_CHECK_PORT_PREFIX,
    INTEGRITY_HOST_PORT_PREFIX,
    buildCheckUrl,
    clearInstallKey,
    clearSessionIntegrityToken,
    ensureDeviceInstallationID,
    exportInstallPublicKey,
    getEnrolmentMarker,
    getInstallKeyId,
    isCheckToken,
    isIntegrityEnrolRequest,
    isRetryableCheckError,
    isTrustedExtensionPageSender,
    parseCheckPortMessage,
    putEnrolmentMarker,
    type IntegrityEnrolDecision,
    type IntegrityEnrolReason,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    clearEnrolmentNeeded,
    enrolBackoff,
    isAttemptLive,
    newCheckToken,
    readAttempt,
    writeAttempt,
    type EnrolAttempt,
} from './enrol-attempt'
import { resumeIntegrityMint } from './integrity'
import { withNamedLock } from './named-lock'
import { readActiveNetwork } from './network'

export const INTEGRITY_ENROL_LOCK = 'pera-integrity-enrol'
export const INTEGRITY_ENROL_DEADLINE_ALARM = 'pera-integrity-enrol-deadline'
/** Inside Turnstile's 300-second token life, leaving time for the enrol call. */
export const ENROL_DEADLINE_MS = 4 * 60 * 1000
export const LIVENESS_TIMEOUT_MS = 5000

const NO_ACTION: IntegrityEnrolDecision = { action: 'none' }

const isEnrolmentEnabled = (): boolean =>
    config.webIntegrityMintEnabled && config.webIntegrityEnrolEnabled

// Open host ports per token. Counted, not a set: a remount or StrictMode's
// double effect opens the new port before the old one's close arrives. In
// memory on purpose: a page still open reconnects after a worker restart.
const hostPortCounts = new Map<string, number>()

const isHosted = (token: string): boolean =>
    (hostPortCounts.get(token) ?? 0) > 0

// Parsed rather than prefix-matched, so `/checkout` on the same origin is not the check page.
const isCheckPageUrl = (value: string | undefined): boolean => {
    if (!value) return false
    try {
        const url = new URL(value)
        return (
            url.origin === config.integrityCheckOrigin &&
            url.pathname === INTEGRITY_CHECK_PATH
        )
    } catch {
        return false
    }
}

// The host permission exposes a tab's url only while it shows our origin, so a
// rejected read (tab gone) and an undefined url (user navigated away) both mean no.
const isTabOnCheckPage = async (tabId: number): Promise<boolean> => {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined)
    return isCheckPageUrl(tab?.url)
}

const isUnfinishedFrameAttempt = (
    attempt: EnrolAttempt | null,
    token: string,
): attempt is EnrolAttempt =>
    attempt !== null &&
    attempt.token === token &&
    attempt.surface === 'frame' &&
    attempt.phase === 'checking' &&
    isAttemptLive(attempt, Date.now())

// The page hosting the frame went away, usually a closed popup. Nothing failed,
// so no backoff: the next page to open hosts again.
const abandonAttempt = async (attempt: EnrolAttempt): Promise<void> => {
    await writeAttempt({ ...attempt, phase: 'done' })
    await chrome.alarms.clear(INTEGRITY_ENROL_DEADLINE_ALARM)
}

// A fresh token means a frame that loads late cannot drive the attempt the tab now owns.
const moveAttemptToTab = async (attempt: EnrolAttempt): Promise<void> => {
    const token = newCheckToken()
    const tab = await chrome.tabs.create({
        url: buildCheckUrl({
            origin: config.integrityCheckOrigin,
            kid: attempt.kid,
            token,
        }),
        active: true,
    })
    await writeAttempt({
        ...attempt,
        token,
        surface: 'tab',
        tabId: tab.id,
        isReady: false,
    })
}

const checkFrameLiveness = async (token: string): Promise<void> => {
    try {
        await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            const attempt = await readAttempt()
            if (!isUnfinishedFrameAttempt(attempt, token) || attempt.isReady) {
                return
            }
            if (!isHosted(token)) {
                await abandonAttempt(attempt)
                return
            }
            logger.warn('Web integrity check frame never reported ready')
            await moveAttemptToTab(attempt)
        })
    } catch (error) {
        logger.warn('Web integrity liveness check failed', { error })
    }
}

// A timer, not an alarm: alarms fire at 30-second granularity, and the worker
// the page's request just woke stays alive well past five seconds.
const scheduleLivenessCheck = (token: string): void => {
    setTimeout(() => {
        void checkFrameLiveness(token)
    }, LIVENESS_TIMEOUT_MS)
}

/** Whether the asking page should host a check. Never throws; a failure means no. */
export const requestEnrolment = async (
    reason: IntegrityEnrolReason,
): Promise<IntegrityEnrolDecision> => {
    if (!isEnrolmentEnabled()) return NO_ACTION
    try {
        return await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            const network = await readActiveNetwork()
            const kid = await getInstallKeyId()
            const marker = await getEnrolmentMarker(network)
            if (marker?.kid === kid) {
                await clearEnrolmentNeeded()
                return NO_ACTION
            }

            const now = Date.now()
            const existing = await readAttempt()
            if (existing && isAttemptLive(existing, now)) return NO_ACTION
            if (await enrolBackoff.isBlocked()) return NO_ACTION

            const attempt: EnrolAttempt = {
                token: newCheckToken(),
                kid,
                network,
                startedAt: now,
                deadlineAt: now + ENROL_DEADLINE_MS,
                surface: 'frame',
                isReady: false,
                phase: 'checking',
            }
            const url = buildCheckUrl({
                origin: config.integrityCheckOrigin,
                kid,
                token: attempt.token,
            })
            // The write goes last: a stored attempt with no deadline alarm
            // would turn every page away until it expired.
            await chrome.alarms.create(INTEGRITY_ENROL_DEADLINE_ALARM, {
                when: attempt.deadlineAt,
            })
            await writeAttempt(attempt)
            scheduleLivenessCheck(attempt.token)
            logger.info('Web integrity enrolment started', { reason, network })
            return { action: 'host', url, deadlineAt: attempt.deadlineAt }
        })
    } catch (error) {
        logger.warn('Web integrity enrolment request failed', { error, reason })
        return NO_ACTION
    }
}

export const installIntegrityEnrolRequestRoute = ({
    chromeLike = chrome,
}: { chromeLike?: typeof chrome } = {}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            if (!isIntegrityEnrolRequest(message)) return false
            // Content scripts share this listener; only extension pages may host.
            if (!isTrustedExtensionPageSender(sender, chromeLike)) {
                sendResponse(NO_ACTION)
                return false
            }
            void requestEnrolment(message.reason).then(sendResponse)
            return true
        },
    )
}

const handleHostGone = async (token: string): Promise<void> => {
    try {
        await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            if (isHosted(token)) return
            const attempt = await readAttempt()
            if (isUnfinishedFrameAttempt(attempt, token)) {
                await abandonAttempt(attempt)
            }
        })
    } catch (error) {
        logger.warn('Web integrity host close failed', { error })
    }
}

export const handleHostPortConnect = (
    port: chrome.runtime.Port,
    chromeLike: typeof chrome = chrome,
): void => {
    if (!port.name.startsWith(INTEGRITY_HOST_PORT_PREFIX)) return
    const token = port.name.slice(INTEGRITY_HOST_PORT_PREFIX.length)
    if (
        !isCheckToken(token) ||
        !isTrustedExtensionPageSender(port.sender, chromeLike)
    ) {
        port.disconnect()
        return
    }
    hostPortCounts.set(token, (hostPortCounts.get(token) ?? 0) + 1)
    port.onDisconnect.addListener(() => {
        const remaining = (hostPortCounts.get(token) ?? 1) - 1
        if (remaining > 0) hostPortCounts.set(token, remaining)
        else hostPortCounts.delete(token)
        void handleHostGone(token)
    })
}

const finishAttempt = async (
    attempt: EnrolAttempt,
    outcome: 'enrolled' | 'failed',
): Promise<void> => {
    await writeAttempt({ ...attempt, phase: 'done' })
    await chrome.alarms.clear(INTEGRITY_ENROL_DEADLINE_ALARM)
    if (outcome === 'enrolled') {
        await enrolBackoff.clear()
        await clearEnrolmentNeeded()
    } else {
        await enrolBackoff.recordFailure()
    }
    // Only while it still shows the check: the user may have taken the tab elsewhere.
    if (
        attempt.surface === 'tab' &&
        attempt.tabId !== undefined &&
        (await isTabOnCheckPage(attempt.tabId))
    ) {
        await chrome.tabs.remove(attempt.tabId).catch(() => undefined)
    }
}

// Swallows its own failure: the attempt must still finish, or it sits in
// `enrolling` until the deadline.
const dropInstallKey = async (): Promise<void> => {
    try {
        await clearInstallKey()
        await clearSessionIntegrityToken()
    } catch (error) {
        logger.warn('Web integrity install key reset failed', { error })
    }
}

const submitEnrolment = async (
    attempt: EnrolAttempt,
    turnstileToken: string,
): Promise<boolean> => {
    try {
        const [deviceInstallationId, publicKey] = await Promise.all([
            ensureDeviceInstallationID(),
            exportInstallPublicKey(),
        ])
        const { kid } = await enrolDevice({
            deviceInstallationId,
            publicKey,
            turnstileToken,
            network: attempt.network,
        })
        if (kid !== attempt.kid) {
            logger.warn('Web integrity enrolment answered for another key', {
                network: attempt.network,
            })
            return false
        }
        await putEnrolmentMarker(attempt.network, {
            kid,
            enrolledAt: new Date().toISOString(),
        })
        return true
    } catch (error) {
        const code = readIntegrityErrorCode(error)
        logger.warn('Web integrity enrolment failed', { code, error })
        // The backend binds this key to another device_id, so only a new key can enrol.
        if (code === 'PUBLIC_KEY_IN_USE') await dropInstallKey()
        return false
    }
}

const handleCheckPortMessage = async (
    port: chrome.runtime.Port,
    token: string,
    raw: unknown,
): Promise<void> => {
    const message = parseCheckPortMessage(raw)
    if (!message) {
        port.disconnect()
        return
    }
    try {
        await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            const attempt = await readAttempt()
            if (
                !attempt ||
                attempt.token !== token ||
                !isAttemptLive(attempt, Date.now())
            ) {
                port.disconnect()
                return
            }
            // The page echoes no kid for a malformed one, so INVALID_KID can
            // never match; the token already proves the frame is ours.
            const isInvalidKid =
                message.type === 'TURNSTILE_ERROR' &&
                message.code === 'INVALID_KID'
            if (message.kid !== attempt.kid && !isInvalidKid) {
                port.disconnect()
                return
            }

            switch (message.type) {
                case 'PAGE_READY': {
                    if (!attempt.isReady) {
                        await writeAttempt({ ...attempt, isReady: true })
                    }
                    return
                }
                case 'INTERACTIVE_REQUIRED':
                case 'INTERACTIVE_DONE': {
                    return
                }
                case 'TURNSTILE_ERROR': {
                    if (
                        message.code === 'TURNSTILE_BLOCKED' &&
                        attempt.surface === 'frame'
                    ) {
                        // Same rule as liveness: no tab the user did not stay for.
                        if (isHosted(token)) await moveAttemptToTab(attempt)
                        else await abandonAttempt(attempt)
                        return
                    }
                    // In the tab the page's retry button is the user-initiated
                    // retry; anywhere else the frame is already gone.
                    if (
                        attempt.surface === 'tab' &&
                        isRetryableCheckError(message.code, message.detail)
                    ) {
                        return
                    }
                    logger.warn('Web integrity check failed', {
                        code: message.code,
                        detail: message.detail,
                    })
                    await finishAttempt(attempt, 'failed')
                    return
                }
                case 'TURNSTILE_SOLVED': {
                    // A reconnecting content script may resend a solve already taken.
                    if (attempt.phase !== 'checking') return
                    const enrolling: EnrolAttempt = {
                        ...attempt,
                        phase: 'enrolling',
                    }
                    await writeAttempt(enrolling)
                    const isEnrolled = await submitEnrolment(
                        enrolling,
                        message.turnstileToken,
                    )
                    await finishAttempt(
                        enrolling,
                        isEnrolled ? 'enrolled' : 'failed',
                    )
                    if (isEnrolled) void resumeIntegrityMint()
                    return
                }
            }
        })
    } catch (error) {
        logger.warn('Web integrity check message failed', { error })
    }
}

// Watching the tab's own port rather than tabs.onRemoved, which would wake the
// worker on every tab close in the browser. Frame closes belong to the host port;
// a tab closed while the worker was evicted is left to the deadline.
const handleCheckPortClosed = async (token: string): Promise<void> => {
    try {
        await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            const attempt = await readAttempt()
            if (
                !attempt ||
                attempt.token !== token ||
                attempt.surface !== 'tab' ||
                attempt.phase !== 'checking' ||
                attempt.tabId === undefined
            ) {
                return
            }
            // A reload shows the check page again and reconnects with the same token.
            if (await isTabOnCheckPage(attempt.tabId)) return
            // Closed or navigated away: either way the tab is not ours to close.
            await finishAttempt({ ...attempt, tabId: undefined }, 'failed')
        })
    } catch (error) {
        logger.warn('Web integrity check tab close failed', { error })
    }
}

export const handleCheckPortConnect = (port: chrome.runtime.Port): void => {
    // onConnect fans out to every listener; another route's port is not ours to close.
    if (!port.name.startsWith(INTEGRITY_CHECK_PORT_PREFIX)) return
    const token = port.name.slice(INTEGRITY_CHECK_PORT_PREFIX.length)
    if (
        !isCheckToken(token) ||
        port.sender?.origin !== config.integrityCheckOrigin ||
        !isCheckPageUrl(port.sender.url)
    ) {
        port.disconnect()
        return
    }
    port.onMessage.addListener(raw => {
        void handleCheckPortMessage(port, token, raw)
    })
    port.onDisconnect.addListener(() => {
        void handleCheckPortClosed(token)
    })
}

export const handleEnrolDeadlineAlarm = async (
    alarm: chrome.alarms.Alarm,
): Promise<void> => {
    if (alarm.name !== INTEGRITY_ENROL_DEADLINE_ALARM) return
    try {
        await withNamedLock(INTEGRITY_ENROL_LOCK, async () => {
            const attempt = await readAttempt()
            if (!attempt || attempt.phase === 'done') return
            logger.warn('Web integrity enrolment timed out', {
                surface: attempt.surface,
            })
            await finishAttempt(attempt, 'failed')
        })
    } catch (error) {
        logger.warn('Web integrity enrolment deadline failed', { error })
    }
}

// Top level in the worker entry, so a worker woken by a port or a message
// already has its listener.
export const installIntegrityEnrolment = ({
    chromeLike = chrome,
}: { chromeLike?: typeof chrome } = {}): void => {
    installIntegrityEnrolRequestRoute({ chromeLike })
    chromeLike.runtime.onConnect.addListener(handleCheckPortConnect)
    chromeLike.runtime.onConnect.addListener(port =>
        handleHostPortConnect(port, chromeLike),
    )
}
