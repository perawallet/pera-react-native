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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { onSessionStorageKeyChanged } from '../storage-events'
import {
    INTEGRITY_CONTROL_SCOPE,
    type IntegrityControlMessage,
} from './check-wire'
import {
    INTEGRITY_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_NEEDED_SESSION_KEY,
    INTEGRITY_LAST_FAILURE_SESSION_KEY,
    INTEGRITY_REVOCATIONS_SESSION_KEY,
    INTEGRITY_TOKEN_SESSION_KEY,
} from './storage-keys'

/**
 * How long a page waits with neither a token nor a recorded failure before
 * calling it an outage: ky's 10 s timeout plus one retry has passed by then.
 */
export const INTEGRITY_PENDING_GRACE_MS = 15_000

const REVOCATIONS_BEFORE_BLOCKED = 2

export type IntegrityBackoff = { failures: number; nextAttemptAt: number }

/** Written by the service worker on every mint or enrol failure. */
export type IntegrityLastFailure = {
    phase: 'mint' | 'enrol'
    /** An `APP_INTEGRITY_*` attest code or a check page error code. */
    code?: string
    status?: number
    /** `timeout`, `dismissed`, or a check page error detail. */
    detail?: string
    at: number
    /** The request never got a response; such a failure does not advance the backoff. */
    isTransport: boolean
}

export type IntegrityAttemptView = {
    surface: 'frame' | 'tab'
    phase: 'checking' | 'enrolling' | 'done'
    /** Epoch ms. */
    startedAt: number
    /** Epoch ms. */
    deadlineAt: number
}

/** The worker's integrity facts, as the UI realm reads them from chrome.storage.session. */
export type IntegritySnapshot = {
    /** Epoch ms. */
    tokenExpiresAt: Nullable<number>
    mintBackoff: Nullable<IntegrityBackoff>
    enrolBackoff: Nullable<IntegrityBackoff>
    attempt: Nullable<IntegrityAttemptView>
    enrolNeededAt: Nullable<number>
    lastFailure: Nullable<IntegrityLastFailure>
    revocations: number
}

/** For logs, analytics and the developer screen; the copy keys on `reason`. */
export type IntegrityFailureCause =
    | 'mint-pending'
    | 'mint-5xx'
    | 'mint-timeout'
    | 'mint-refused'
    | 'attest-enrolment-required'
    | 'attest-revoked'
    | `enrol-check-error:${string}`
    | 'enrol-timeout'
    | 'enrol-dismissed'
    | 'enrol-failed'
    | 'no-host'

export type IntegrityDegradedReason = 'service' | 'verification' | 'blocked'

export type IntegrityAccessState =
    | { status: 'ready'; expiresAt: number }
    | { status: 'pending' }
    | { status: 'checking'; surface: 'frame' | 'tab' }
    | { status: 'needs-interaction' }
    | {
          status: 'degraded'
          reason: IntegrityDegradedReason
          cause: IntegrityFailureCause
          /** Epoch ms of the worker's next attempt on its own, if it will make one. */
          nextAttemptAt: Nullable<number>
      }
    | { status: 'offline' }

export type IntegrityAccessInputs = {
    now: number
    /** When this realm first saw no token; starts the grace window. */
    pendingSince: number
    isOnline: boolean
    /** The check frame is expanded and waits for a click. */
    needsInteraction: boolean
    /** The user closed the expanded check frame while its attempt lives on. */
    isFrameDismissed: boolean
    /**
     * Enrolment waits for the user to commit to onboarding, so until then a
     * missing enrolment is not something they can act on.
     */
    isEnrolmentDeferred: boolean
}

const VERIFICATION_ATTEST_CODES: Record<string, IntegrityFailureCause> = {
    APP_INTEGRITY_ENROLMENT_REQUIRED: 'attest-enrolment-required',
    APP_INTEGRITY_REVOKED: 'attest-revoked',
}

const degraded = (
    reason: IntegrityDegradedReason,
    cause: IntegrityFailureCause,
    backoff: Nullable<IntegrityBackoff>,
): IntegrityAccessState => ({
    status: 'degraded',
    reason,
    cause,
    nextAttemptAt: backoff?.nextAttemptAt ?? null,
})

const enrolFailureCause = (
    failure: IntegrityLastFailure,
): IntegrityFailureCause => {
    if (failure.detail === 'timeout') return 'enrol-timeout'
    if (failure.detail === 'dismissed') return 'enrol-dismissed'
    return failure.code ? `enrol-check-error:${failure.code}` : 'enrol-failed'
}

const fromLastFailure = (
    snapshot: IntegritySnapshot,
    failure: IntegrityLastFailure,
    now: number,
): IntegrityAccessState => {
    if (failure.phase === 'enrol') {
        return degraded(
            'verification',
            enrolFailureCause(failure),
            snapshot.enrolBackoff,
        )
    }
    const verificationCause = failure.code
        ? VERIFICATION_ATTEST_CODES[failure.code]
        : undefined
    if (verificationCause) {
        // An open page hosts the hidden check within seconds; a solve that lands
        // quietly should show nothing at all.
        if (now - failure.at < INTEGRITY_PENDING_GRACE_MS) {
            return { status: 'pending' }
        }
        return degraded(
            'verification',
            verificationCause,
            snapshot.enrolBackoff,
        )
    }
    // A blip (offline for a moment, a timeout) usually clears on the next try,
    // which the page's online and open edges ask for at once.
    if (failure.isTransport && now - failure.at < INTEGRITY_PENDING_GRACE_MS) {
        return { status: 'pending' }
    }
    const cause: IntegrityFailureCause = failure.isTransport
        ? 'mint-timeout'
        : (failure.status ?? 0) >= 500
          ? 'mint-5xx'
          : 'mint-refused'
    return degraded('service', cause, snapshot.mintBackoff)
}

/** Precedence, highest first: offline, ready, needs-interaction, checking, degraded, pending. */
export const deriveIntegrityAccessState = (
    snapshot: IntegritySnapshot,
    inputs: IntegrityAccessInputs,
): IntegrityAccessState => {
    const state = deriveUndeferred(snapshot, inputs)
    if (
        inputs.isEnrolmentDeferred &&
        state.status === 'degraded' &&
        state.reason === 'verification'
    ) {
        return { status: 'pending' }
    }
    return state
}

const deriveUndeferred = (
    snapshot: IntegritySnapshot,
    inputs: IntegrityAccessInputs,
): IntegrityAccessState => {
    const { now } = inputs
    if (!inputs.isOnline) return { status: 'offline' }
    if (snapshot.tokenExpiresAt !== null && snapshot.tokenExpiresAt > now) {
        return { status: 'ready', expiresAt: snapshot.tokenExpiresAt }
    }
    if (inputs.needsInteraction) return { status: 'needs-interaction' }

    const isAttemptLive =
        snapshot.attempt !== null &&
        snapshot.attempt.phase !== 'done' &&
        now < snapshot.attempt.deadlineAt
    if (isAttemptLive && inputs.isFrameDismissed) {
        return degraded(
            'verification',
            'enrol-dismissed',
            snapshot.enrolBackoff,
        )
    }
    if (isAttemptLive && snapshot.attempt) {
        return { status: 'checking', surface: snapshot.attempt.surface }
    }

    if (snapshot.revocations >= REVOCATIONS_BEFORE_BLOCKED) {
        return degraded('blocked', 'attest-revoked', snapshot.enrolBackoff)
    }
    if (snapshot.lastFailure) {
        return fromLastFailure(snapshot, snapshot.lastFailure, now)
    }

    if (now - inputs.pendingSince < INTEGRITY_PENDING_GRACE_MS) {
        return { status: 'pending' }
    }
    if (snapshot.enrolNeededAt !== null) {
        return degraded('verification', 'no-host', snapshot.enrolBackoff)
    }
    return degraded('service', 'mint-pending', snapshot.mintBackoff)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const parseBackoff = (value: unknown): Nullable<IntegrityBackoff> =>
    isRecord(value) &&
    typeof value.failures === 'number' &&
    typeof value.nextAttemptAt === 'number'
        ? { failures: value.failures, nextAttemptAt: value.nextAttemptAt }
        : null

const parseTokenExpiresAt = (value: unknown): Nullable<number> => {
    if (!isRecord(value) || typeof value.expiresAt !== 'string') return null
    const expiresAt = Date.parse(value.expiresAt)
    return Number.isFinite(expiresAt) ? expiresAt : null
}

// Picks the fields the UI needs; the check token in the same record stays behind.
const parseAttempt = (value: unknown): Nullable<IntegrityAttemptView> =>
    isRecord(value) &&
    (value.surface === 'frame' || value.surface === 'tab') &&
    (value.phase === 'checking' ||
        value.phase === 'enrolling' ||
        value.phase === 'done') &&
    typeof value.startedAt === 'number' &&
    typeof value.deadlineAt === 'number'
        ? {
              surface: value.surface,
              phase: value.phase,
              startedAt: value.startedAt,
              deadlineAt: value.deadlineAt,
          }
        : null

const parseLastFailure = (value: unknown): Nullable<IntegrityLastFailure> => {
    if (
        !isRecord(value) ||
        (value.phase !== 'mint' && value.phase !== 'enrol') ||
        typeof value.at !== 'number' ||
        typeof value.isTransport !== 'boolean'
    ) {
        return null
    }
    return {
        phase: value.phase,
        at: value.at,
        isTransport: value.isTransport,
        ...(typeof value.code === 'string' ? { code: value.code } : {}),
        ...(typeof value.status === 'number' ? { status: value.status } : {}),
        ...(typeof value.detail === 'string' ? { detail: value.detail } : {}),
    }
}

/** Every key the snapshot reads; a change to any of them can move the state. */
export const INTEGRITY_SNAPSHOT_KEYS = [
    INTEGRITY_TOKEN_SESSION_KEY,
    INTEGRITY_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    INTEGRITY_ENROL_NEEDED_SESSION_KEY,
    INTEGRITY_LAST_FAILURE_SESSION_KEY,
    INTEGRITY_REVOCATIONS_SESSION_KEY,
]

export const readIntegritySnapshot = async (): Promise<IntegritySnapshot> => {
    const stored = await chrome.storage.session.get(INTEGRITY_SNAPSHOT_KEYS)
    const enrolNeededAt = stored[INTEGRITY_ENROL_NEEDED_SESSION_KEY]
    const revocations = stored[INTEGRITY_REVOCATIONS_SESSION_KEY]
    return {
        tokenExpiresAt: parseTokenExpiresAt(
            stored[INTEGRITY_TOKEN_SESSION_KEY],
        ),
        mintBackoff: parseBackoff(stored[INTEGRITY_BACKOFF_SESSION_KEY]),
        enrolBackoff: parseBackoff(stored[INTEGRITY_ENROL_BACKOFF_SESSION_KEY]),
        attempt: parseAttempt(stored[INTEGRITY_ENROL_ATTEMPT_SESSION_KEY]),
        enrolNeededAt: typeof enrolNeededAt === 'number' ? enrolNeededAt : null,
        lastFailure: parseLastFailure(
            stored[INTEGRITY_LAST_FAILURE_SESSION_KEY],
        ),
        revocations: typeof revocations === 'number' ? revocations : 0,
    }
}

export const onIntegritySnapshotChanged = (
    listener: () => void,
): (() => void) => onSessionStorageKeyChanged(INTEGRITY_SNAPSHOT_KEYS, listener)

type IntegrityControl =
    | { kind: 'retry'; soft?: boolean }
    | { kind: 'token-rejected'; tokenExpiresAt: Nullable<number> }

/** Fire and forget: the worker acts on what it can, and a closed worker wakes on the message. */
export const sendIntegrityControl = (control: IntegrityControl): void => {
    const message: IntegrityControlMessage =
        control.kind === 'retry'
            ? {
                  scope: INTEGRITY_CONTROL_SCOPE,
                  kind: 'retry',
                  soft: control.soft === true,
              }
            : {
                  scope: INTEGRITY_CONTROL_SCOPE,
                  kind: 'token-rejected',
                  tokenExpiresAt: control.tokenExpiresAt,
              }
    void chrome.runtime.sendMessage(message).catch(() => {
        // No listener yet (worker starting): the next page open retries softly.
    })
}
