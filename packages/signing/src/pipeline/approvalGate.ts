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

/**
 * Decouples the signing machine from any "user is looking at a review screen"
 * concept: `awaiting_user` is a generic external sync point, and the gate is
 * the only thing deciding whether that wait is instantaneous (headless) or
 * blocks on a UI interaction.
 *
 * The actor lifecycle owns registration, done synchronously before the actor
 * can reach `awaiting_user`. Keyed process-wide by request id, matching the
 * actor ref map and the signing store, so all three agree on identity.
 */

type ApprovalResult = 'approved' | 'rejected' | 'cancelled'

type Deferred = {
    promise: Promise<ApprovalResult>
    resolve: (result: ApprovalResult) => void
}

const gates = new Map<string, Deferred>()

const makeDeferred = (): Deferred => {
    let resolve!: (result: ApprovalResult) => void
    const promise = new Promise<ApprovalResult>(r => {
        resolve = r
    })
    return { promise, resolve }
}

/**
 * Register a gate for a request. Subsequent `waitFor` calls for this
 * request will block until `approve`/`reject` is called. Idempotent.
 */
const register = (requestId: string): void => {
    if (gates.has(requestId)) return
    gates.set(requestId, makeDeferred())
}

/**
 * No-op when nothing is registered — the request is headless. The map entry
 * stays so a later `waitFor` (the actor finishing validation AFTER the user
 * confirmed) still sees the result; `unregister` owns cleanup.
 */
const approve = (requestId: string): void => {
    const gate = gates.get(requestId)
    if (!gate) return
    gate.resolve('approved')
}

/**
 * Like `approve`, the entry persists until `unregister` — otherwise a Cancel tap
 * during the async validating phase is silently discarded by the time the actor
 * reaches `awaiting_user`.
 */
const reject = (requestId: string): void => {
    const gate = gates.get(requestId)
    if (!gate) return
    gate.resolve('rejected')
}

/**
 * Awaited every time the machine pauses at `awaiting_user`, whatever the source.
 * An unregistered gate resolves `'approved'` immediately — the headless
 * fast-path for sources outside `INTERACTIVE_SOURCES`.
 */
const waitFor = (requestId: string): Promise<ApprovalResult> => {
    const gate = gates.get(requestId)
    if (gate) return gate.promise
    return Promise.resolve('approved')
}

const isRegistered = (requestId: string): boolean => gates.has(requestId)

/**
 * Resolves a still-pending deferred with `'cancelled'` so the awaiting `.then`
 * runs and releases its closure — otherwise the subscriber leaks a reference to
 * the actor for the lifetime of the JS context.
 */
const unregister = (requestId: string): void => {
    const gate = gates.get(requestId)
    if (gate) gate.resolve('cancelled')
    gates.delete(requestId)
}

/** Test-only: drop every gate. */
const __resetForTests = (): void => {
    gates.clear()
}

export const approvalGate = {
    register,
    unregister,
    approve,
    reject,
    waitFor,
    isRegistered,
    __resetForTests,
}
