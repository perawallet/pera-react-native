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
    isWalletMode,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_NEEDED_SESSION_KEY,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { createSessionBackoff } from './session-backoff'

const MINUTE_MS = 60 * 1000

// Enrolment can show UI, so it never loops: one attempt per trigger, and a
// 24-hour cap rather than the mint loop's hour. Here rather than in
// integrity-enrol.ts so the mint loop can record a failure without a cycle.
export const enrolBackoff = createSessionBackoff({
    key: INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    floorMs: 5 * MINUTE_MS,
    capMs: 24 * 60 * MINUTE_MS,
})

export type EnrolAttempt = {
    token: string
    kid: string
    deployment: WalletMode
    startedAt: number
    deadlineAt: number
    surface: 'frame' | 'tab'
    tabId?: number
    isReady: boolean
    phase: 'checking' | 'enrolling' | 'done'
}

const PHASES: readonly string[] = ['checking', 'enrolling', 'done']

export const readAttempt = async (): Promise<Nullable<EnrolAttempt>> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    )
    const value = stored[INTEGRITY_ENROL_ATTEMPT_SESSION_KEY] as Optional<
        Partial<EnrolAttempt>
    >
    if (
        typeof value?.token !== 'string' ||
        typeof value.kid !== 'string' ||
        !isWalletMode(value.deployment) ||
        typeof value.startedAt !== 'number' ||
        typeof value.deadlineAt !== 'number' ||
        (value.surface !== 'frame' && value.surface !== 'tab') ||
        typeof value.isReady !== 'boolean' ||
        typeof value.phase !== 'string' ||
        !PHASES.includes(value.phase)
    ) {
        return null
    }
    return value as EnrolAttempt
}

export const writeAttempt = async (attempt: EnrolAttempt): Promise<void> => {
    await chrome.storage.session.set({
        [INTEGRITY_ENROL_ATTEMPT_SESSION_KEY]: attempt,
    })
}

export const isAttemptLive = (attempt: EnrolAttempt, now: number): boolean =>
    attempt.phase !== 'done' && now < attempt.deadlineAt

// 16 random bytes: unguessable by any page that was not handed the URL.
export const newCheckToken = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

// A timestamp rather than `true`: writing the same value again would not fire
// storage.onChanged, and every attest 403 must wake the watching pages.
export const markEnrolmentNeeded = async (): Promise<void> => {
    await chrome.storage.session.set({
        [INTEGRITY_ENROL_NEEDED_SESSION_KEY]: Date.now(),
    })
}

export const isEnrolmentNeeded = async (): Promise<boolean> => {
    const stored = await chrome.storage.session.get(
        INTEGRITY_ENROL_NEEDED_SESSION_KEY,
    )
    return typeof stored[INTEGRITY_ENROL_NEEDED_SESSION_KEY] === 'number'
}

export const clearEnrolmentNeeded = async (): Promise<void> => {
    await chrome.storage.session.remove(INTEGRITY_ENROL_NEEDED_SESSION_KEY)
}
