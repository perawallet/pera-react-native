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
    INTEGRITY_CHECK_TOKEN_PARAM,
    INTEGRITY_ENROL_SCOPE,
    INTEGRITY_HOST_PORT_PREFIX,
    isCheckToken,
    parseIntegrityEnrolDecision,
    type IntegrityEnrolDecision,
    type IntegrityEnrolReason,
} from './check-wire'
import {
    INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    INTEGRITY_ENROL_NEEDED_SESSION_KEY,
} from './storage-keys'

const HOST_PORT_RETRY_MS = 1000

const onSessionKeyChange = (
    chromeLike: typeof chrome,
    key: string,
    listener: (change: chrome.storage.StorageChange) => void,
): (() => void) => {
    const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
    ): void => {
        const change = changes[key]
        if (areaName === 'session' && change) listener(change)
    }
    chromeLike.storage.onChanged.addListener(handler)
    return () => chromeLike.storage.onChanged.removeListener(handler)
}

/** Asks the worker whether this page should host the check. Never throws; any failure means no. */
export const requestIntegrityEnrolment = async (
    reason: IntegrityEnrolReason,
    chromeLike: typeof chrome = chrome,
): Promise<IntegrityEnrolDecision> => {
    try {
        const response: unknown = await chromeLike.runtime.sendMessage({
            scope: INTEGRITY_ENROL_SCOPE,
            kind: 'request',
            reason,
        })
        return parseIntegrityEnrolDecision(response)
    } catch {
        return { action: 'none' }
    }
}

// The worker clears the flag once enrolment lands; only a raised flag is news.
export const onIntegrityEnrolmentNeeded = (
    listener: () => void,
    chromeLike: typeof chrome = chrome,
): (() => void) =>
    onSessionKeyChange(
        chromeLike,
        INTEGRITY_ENROL_NEEDED_SESSION_KEY,
        change => {
            if (change.newValue !== undefined) listener()
        },
    )

/**
 * Fires once the attempt behind a hosted check URL is over: finished, timed
 * out, removed, or moved to a tab under a new token. A frame that loads after
 * the worker gave up on it could otherwise still expand beside the tab.
 */
export const onHostedCheckEnded = (
    url: string,
    listener: () => void,
    chromeLike: typeof chrome = chrome,
): (() => void) => {
    const token = new URL(url).searchParams.get(INTEGRITY_CHECK_TOKEN_PARAM)
    let isSubscribed = true
    // Reads the record rather than the change, and runs once on subscribe too:
    // the attempt may have ended before this page started listening.
    const check = (): void => {
        void chromeLike.storage.session
            .get(INTEGRITY_ENROL_ATTEMPT_SESSION_KEY)
            .then(stored => {
                const attempt = stored[INTEGRITY_ENROL_ATTEMPT_SESSION_KEY] as
                    | { token?: unknown; phase?: unknown }
                    | undefined
                const isOver =
                    attempt?.token !== token || attempt.phase === 'done'
                if (isSubscribed && isOver) listener()
            })
            .catch(() => {
                if (isSubscribed) listener()
            })
    }
    const unsubscribe = onSessionKeyChange(
        chromeLike,
        INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
        check,
    )
    check()
    return () => {
        isSubscribed = false
        unsubscribe()
    }
}

/**
 * Holds the host port the worker watches while this page shows a frame: when
 * it closes, the worker ends the attempt quietly instead of waiting out its
 * deadline or opening a tab. Returns the release.
 */
export const holdIntegrityCheckHost = (
    url: string,
    chromeLike: typeof chrome = chrome,
): (() => void) => {
    const token = new URL(url).searchParams.get(INTEGRITY_CHECK_TOKEN_PARAM)
    if (!isCheckToken(token)) return () => {}
    let isReleased = false
    let port: chrome.runtime.Port | null = null
    let retry: ReturnType<typeof setTimeout> | undefined

    const connect = (): void => {
        try {
            port = chromeLike.runtime.connect({
                name: `${INTEGRITY_HOST_PORT_PREFIX}${token}`,
            })
        } catch {
            port = null
            return
        }
        // A worker restart drops the port; the delay bounds a worker that keeps refusing it.
        port.onDisconnect.addListener(() => {
            port = null
            if (!isReleased) retry = setTimeout(connect, HOST_PORT_RETRY_MS)
        })
    }

    connect()
    return () => {
        isReleased = true
        clearTimeout(retry)
        port?.disconnect()
        port = null
    }
}
