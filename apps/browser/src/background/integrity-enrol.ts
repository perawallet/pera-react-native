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

import { config } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import {
    INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    buildCheckUrl,
    getEnrolmentMarker,
    getInstallKeyId,
    isIntegrityEnrolRequest,
    isTrustedExtensionPageSender,
    type IntegrityEnrolDecision,
    type IntegrityEnrolReason,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    clearEnrolmentNeeded,
    isAttemptLive,
    newCheckToken,
    readAttempt,
    writeAttempt,
    type EnrolAttempt,
} from './enrol-attempt'
import { withNamedLock } from './named-lock'
import { readActiveNetwork } from './network'
import { createSessionBackoff } from './session-backoff'

export const INTEGRITY_ENROL_LOCK = 'pera-integrity-enrol'
export const INTEGRITY_ENROL_DEADLINE_ALARM = 'pera-integrity-enrol-deadline'
/** Inside Turnstile's 300-second token life, leaving time for the enrol call. */
export const ENROL_DEADLINE_MS = 4 * 60 * 1000

const MINUTE_MS = 60 * 1000
const NO_ACTION: IntegrityEnrolDecision = { action: 'none' }

// Enrolment can show UI, so it never loops: one attempt per trigger, and a
// 24-hour cap rather than the mint loop's hour.
export const enrolBackoff = createSessionBackoff({
    key: INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    floorMs: 5 * MINUTE_MS,
    capMs: 24 * 60 * MINUTE_MS,
})

const isEnrolmentEnabled = (): boolean =>
    config.webIntegrityMintEnabled && config.webIntegrityEnrolEnabled

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
            await writeAttempt(attempt)
            await chrome.alarms.create(INTEGRITY_ENROL_DEADLINE_ALARM, {
                when: attempt.deadlineAt,
            })
            logger.info('Web integrity enrolment started', { reason, network })
            return {
                action: 'host',
                url: buildCheckUrl({
                    origin: config.integrityCheckOrigin,
                    kid,
                    token: attempt.token,
                }),
                deadlineAt: attempt.deadlineAt,
            }
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
