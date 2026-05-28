/*
 Copyright 2022-2025 Pera Wallet, LDA
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
 * The approval gate decouples the signing machine from any "user is
 * looking at a review screen" concept. The machine still has a pause
 * state (`awaiting_user`) but it is now a generic external sync point —
 * the lifecycle hook waits on the gate, the gate is the only thing that
 * decides whether the wait is instantaneous (headless internal flow) or
 * blocks on a UI interaction (external source rendered by the
 * `SigningOverlays` drivers).
 *
 * The actor lifecycle owns registration: `createActorForRequest`
 * registers the gate synchronously when the request's `sourceType` is
 * in `INTERACTIVE_SOURCES`, before the actor can reach `awaiting_user`.
 *
 * Registration is process-wide and keyed by request id (string) — this
 * matches both the actor ref map and the React-Native signing store, so
 * the gate, the machine, and the store all agree on identity.
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
 * Resolve a registered gate with `'approved'`. No-op if no gate is
 * registered (the caller is presumed to have already decided that this
 * request is headless).
 *
 * The map entry stays so a subsequent `waitFor` (e.g. when the actor
 * finishes validating *after* the user has already confirmed) still
 * returns the prior result. Cleanup is owned by `unregister`, called
 * from the lifecycle's terminal handler.
 */
const approve = (requestId: string): void => {
    const gate = gates.get(requestId)
    if (!gate) return
    gate.resolve('approved')
}

/**
 * Resolve a registered gate with `'rejected'`. No-op when no gate is
 * registered. Like `approve`, the map entry persists until `unregister`
 * — otherwise a Cancel tap during the (async) validating phase would be
 * silently discarded by the time the actor reaches `awaiting_user`.
 */
const reject = (requestId: string): void => {
    const gate = gates.get(requestId)
    if (!gate) return
    gate.resolve('rejected')
}

/**
 * Wait for the gate to resolve. The lifecycle awaits this every time the
 * machine pauses at `awaiting_user`, regardless of source:
 *
 * - Registered + pending → returns the gate's promise; resolves when the
 *   user confirms or cancels.
 * - Registered + already resolved → returns the resolved promise
 *   immediately (microtask) with the prior result.
 * - Not registered → returns `Promise.resolve('approved')` — the headless
 *   fast-path for sources outside `INTERACTIVE_SOURCES`.
 */
const waitFor = (requestId: string): Promise<ApprovalResult> => {
    const gate = gates.get(requestId)
    if (gate) return gate.promise
    return Promise.resolve('approved')
}

const isRegistered = (requestId: string): boolean => gates.has(requestId)

/**
 * Drop a registered gate. If the deferred is still pending, resolves it
 * with `'cancelled'` so any awaiting `.then` chain runs and releases its
 * closure (otherwise the awaiting subscriber leaks a reference to the
 * actor for the lifetime of the JS context).
 *
 * Called from the lifecycle's terminal handler and `stopActor` path.
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
