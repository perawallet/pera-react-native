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

import { isTrustedExtensionPageSender } from '@perawallet/wallet-extension-platform-chrome/messaging'

// The offscreen document has no chrome.storage.session, where the vault's
// unlock flag lives, and must never get it proxied: the vault key sits beside
// the flag. Only the boolean crosses.
export const LOCK_STATE_SCOPE = 'pera-lock-state'

type LockStateQuery = { scope: typeof LOCK_STATE_SCOPE; kind: 'get' }
type LockStateChange = {
    scope: typeof LOCK_STATE_SCOPE
    kind: 'changed'
    isLocked: boolean
}
type LockStateAnswer = { isLocked: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isLockStateQuery = (value: unknown): value is LockStateQuery =>
    isRecord(value) && value.scope === LOCK_STATE_SCOPE && value.kind === 'get'

const isLockStateChange = (value: unknown): value is LockStateChange =>
    isRecord(value) &&
    value.scope === LOCK_STATE_SCOPE &&
    value.kind === 'changed' &&
    typeof value.isLocked === 'boolean'

const isLockStateAnswer = (value: unknown): value is LockStateAnswer =>
    isRecord(value) && typeof value.isLocked === 'boolean'

/**
 * Service-worker side: answers the lock state and announces each change.
 * Registered at the worker's top level, so a worker woken by the auto-lock
 * alarm or a storage change already has it in place.
 */
export const installLockStateHost = ({
    chromeLike = chrome,
    isUnlocked,
    onLockStateChanged,
}: {
    chromeLike?: typeof chrome
    isUnlocked: () => Promise<boolean>
    onLockStateChanged: (listener: (isUnlocked: boolean) => void) => unknown
}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse: (answer: LockStateAnswer) => void) => {
            if (!isLockStateQuery(message)) return false
            if (!isTrustedExtensionPageSender(sender, chromeLike)) return false
            // A state that can't be read counts as locked.
            void isUnlocked()
                .then(
                    unlocked => !unlocked,
                    (): boolean => true,
                )
                .then(isLocked => sendResponse({ isLocked }))
            return true
        },
    )
    onLockStateChanged(isUnlocked => {
        const change: LockStateChange = {
            scope: LOCK_STATE_SCOPE,
            kind: 'changed',
            isLocked: !isUnlocked,
        }
        // No offscreen document means no live connection to tell.
        chromeLike.runtime.sendMessage(change).catch(() => undefined)
    })
}

export type OffscreenLockState = {
    isLocked: () => boolean
    /** Called on each change after `ready`, never for the seed itself. */
    subscribe: (listener: (isLocked: boolean) => void) => () => void
    /** Settles once the worker has answered, or failed to. */
    ready: Promise<void>
}

/**
 * Offscreen side: mirrors the worker's lock state. Locked until the worker
 * answers, so nothing is pushed to a page before the state is known.
 */
export const createOffscreenLockState = (
    chromeLike: typeof chrome = chrome,
): OffscreenLockState => {
    let isLocked = true
    let hasHeardChange = false
    let isSeeded = false
    const listeners = new Set<(isLocked: boolean) => void>()

    const apply = (next: boolean): void => {
        if (next === isLocked) return
        isLocked = next
        if (isSeeded) listeners.forEach(listener => listener(next))
    }

    chromeLike.runtime.onMessage.addListener((message, sender) => {
        if (!isLockStateChange(message)) return false
        if (!isTrustedExtensionPageSender(sender, chromeLike)) return false
        hasHeardChange = true
        apply(message.isLocked)
        return false
    })

    const query: LockStateQuery = { scope: LOCK_STATE_SCOPE, kind: 'get' }
    const ready = chromeLike.runtime.sendMessage(query).then(
        (answer: unknown) => {
            // A change that arrived while the query was in flight is newer.
            if (!hasHeardChange && isLockStateAnswer(answer)) {
                apply(answer.isLocked)
            }
            isSeeded = true
        },
        () => {
            isSeeded = true
        },
    )

    return {
        isLocked: () => isLocked,
        subscribe: listener => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        ready,
    }
}
