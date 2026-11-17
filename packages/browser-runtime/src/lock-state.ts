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

import type { Optional } from '@perawallet/wallet-core-shared'
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
/** Empty when the worker can't read the state. */
type LockStateAnswer = { isLocked?: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isLockStateQuery = (value: unknown): value is LockStateQuery =>
    isRecord(value) && value.scope === LOCK_STATE_SCOPE && value.kind === 'get'

const isLockStateChange = (value: unknown): value is LockStateChange =>
    isRecord(value) &&
    value.scope === LOCK_STATE_SCOPE &&
    value.kind === 'changed' &&
    typeof value.isLocked === 'boolean'

const isKnownLockStateAnswer = (
    value: unknown,
): value is Required<LockStateAnswer> =>
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
            void isUnlocked().then(
                unlocked => sendResponse({ isLocked: !unlocked }),
                () => sendResponse({}),
            )
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
    /** True while the state is unknown, so nothing reaches a page early. */
    isLocked: () => boolean
    /**
     * Called on each change after `ready`, never for the seed itself. While
     * the state is unknown, the first one heard counts as a change.
     */
    subscribe: (listener: (isLocked: boolean) => void) => () => void
    /** The seeded state once the worker has answered; undefined if it couldn't say. */
    ready: Promise<Optional<boolean>>
}

/** Offscreen side: mirrors the worker's lock state. */
export const createOffscreenLockState = (
    chromeLike: typeof chrome = chrome,
): OffscreenLockState => {
    let isLocked = true
    let isKnown = false
    let hasHeardChange = false
    let isSeeded = false
    const listeners = new Set<(isLocked: boolean) => void>()

    const apply = (next: boolean): void => {
        // An unknown state shows as locked, so a real lock after a failed seed
        // would otherwise look like no change and never reach the pages.
        if (isKnown && next === isLocked) return
        isLocked = next
        isKnown = true
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
            if (!hasHeardChange && isKnownLockStateAnswer(answer)) {
                apply(answer.isLocked)
            }
            isSeeded = true
            return isKnown ? isLocked : undefined
        },
        () => {
            isSeeded = true
            return isKnown ? isLocked : undefined
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
