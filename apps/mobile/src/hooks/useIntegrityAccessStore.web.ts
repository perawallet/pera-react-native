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

import { create } from 'zustand'
import {
    INTEGRITY_PENDING_GRACE_MS,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable } from '@perawallet/wallet-core-shared'

// Session facts mirrored from the service worker, which is their only writer;
// nothing here is persisted.
type IntegrityAccessStoreState = {
    snapshot: Nullable<IntegritySnapshot>
    /** Epoch ms this realm last re-derived at; moves on snapshots and timer ticks. */
    now: number
    /** Epoch ms this realm started seeing no live token; null while one lives. */
    pendingSince: Nullable<number>
    /** Bumped on every no-token to live-token edge, for consumers that recover on it. */
    readyEpoch: number
}

type IntegrityAccessStoreActions = {
    applySnapshot: (snapshot: IntegritySnapshot, now: number) => void
    tick: (now: number) => void
    resetState: () => void
}

type IntegrityAccessStore = IntegrityAccessStoreState &
    IntegrityAccessStoreActions

const initialState: IntegrityAccessStoreState = {
    snapshot: null,
    now: 0,
    pendingSince: null,
    readyEpoch: 0,
}

const hasLiveToken = (snapshot: Nullable<IntegritySnapshot>, now: number) =>
    snapshot?.tokenExpiresAt != null && snapshot.tokenExpiresAt > now

// lanekeep-ignore-next-line pera/store-in-wipe-registry reason: device integrity facts mirrored from the service worker, their only writer; a reset desyncs them until the next snapshot
export const useIntegrityAccessStore = create<IntegrityAccessStore>()(set => ({
    ...initialState,
    applySnapshot: (snapshot, now) =>
        set(state => {
            const isReady = hasLiveToken(snapshot, now)
            const wasReady = hasLiveToken(state.snapshot, now)
            const isReadyEdge = isReady && !wasReady && state.snapshot !== null
            return {
                snapshot,
                now,
                pendingSince: isReady ? null : (state.pendingSince ?? now),
                readyEpoch: state.readyEpoch + (isReadyEdge ? 1 : 0),
            }
        }),
    tick: now =>
        set(state => ({
            now,
            pendingSince: hasLiveToken(state.snapshot, now)
                ? null
                : (state.pendingSince ?? now),
        })),
    resetState: () => set(initialState),
}))

/** Calls `onReady` on every edge where a token lands after none. Returns an unsubscribe. */
export const subscribeToIntegrityReady = (onReady: () => void): (() => void) =>
    useIntegrityAccessStore.subscribe((state, previous) => {
        if (state.readyEpoch !== previous.readyEpoch) onReady()
    })

/**
 * The next moment the derived state can change with no new fact from the
 * worker: the token expiring, an attempt deadline, or a grace window ending.
 */
export const nextIntegrityDerivationAt = (
    snapshot: IntegritySnapshot,
    pendingSince: Nullable<number>,
    now: number,
): Nullable<number> => {
    const candidates = [
        snapshot.tokenExpiresAt,
        snapshot.attempt?.deadlineAt,
        snapshot.attempt
            ? snapshot.attempt.startedAt + INTEGRITY_PENDING_GRACE_MS
            : null,
        pendingSince === null
            ? null
            : pendingSince + INTEGRITY_PENDING_GRACE_MS,
        snapshot.lastFailure
            ? snapshot.lastFailure.at + INTEGRITY_PENDING_GRACE_MS
            : null,
    ].filter((at): at is number => typeof at === 'number' && at > now)
    return candidates.length > 0 ? Math.min(...candidates) : null
}
