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

import { describe, it, expect, vi } from 'vitest'
import { createActor, fromCallback, waitFor } from 'xstate'
import { LEDGER_CONFIRMATION_TIMEOUT_MS } from '@perawallet/wallet-core-ledger'
import { hardwareSigningMachine } from '../hardwareSigningMachine'
import type { HardwareSigningInput } from '../hardwareSigningMachine.context'

const makeInput = (
    overrides: Partial<HardwareSigningInput> = {},
): HardwareSigningInput => ({
    groups: [],
    allAccounts: [],
    hardwareWalletRegistry: {} as never,
    encodeTransaction: vi.fn() as never,
    totalTxs: 1,
    deviceName: 'Nano X',
    operation: 'transaction',
    ...overrides,
})

describe('hardwareSigningMachine', () => {
    it('reaches done with collected results on ALL_DONE', async () => {
        const fakeResult = {
            signedData: { type: 'transactions', signed: [] },
            signers: [],
        } as never
        const stubActor = fromCallback(({ sendBack }) => {
            sendBack({ type: 'AWAITING_APPROVAL' })
            sendBack({ type: 'SIGNING_STARTED' })
            sendBack({ type: 'GROUP_SIGNED', result: fakeResult })
            sendBack({ type: 'ALL_DONE' })
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, { input: makeInput() })
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))
        const snapshot = actor.getSnapshot()
        expect(snapshot.matches('done')).toBe(true)
        expect(snapshot.output).toEqual({
            kind: 'success',
            results: [fakeResult],
        })
    })

    it('enters error state on STRATEGY_ERROR and stays until ACKNOWLEDGE_ERROR', async () => {
        const stubActor = fromCallback(({ sendBack }) => {
            sendBack({
                type: 'STRATEGY_ERROR',
                error: {
                    kind: 'bluetooth_disabled',
                    cause: new Error('off'),
                },
            })
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, { input: makeInput() })
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(actor.getSnapshot().matches('error')).toBe(true)
        expect(actor.getSnapshot().context.error?.kind).toBe(
            'bluetooth_disabled',
        )

        actor.send({ type: 'ACKNOWLEDGE_ERROR' })
        const snapshot = actor.getSnapshot()
        expect(snapshot.matches('done')).toBe(true)
        expect(snapshot.output).toEqual({
            kind: 'error',
            error: {
                kind: 'bluetooth_disabled',
                cause: expect.any(Error),
            },
        })
    })

    it('RETRY from error re-enters active with cleared error and reset progress', async () => {
        // Only emit STRATEGY_ERROR on the first invocation so the post-RETRY
        // re-invoke leaves the machine sitting in `active` rather than
        // immediately bouncing back into `error`.
        let invokeCount = 0
        const stubActor = fromCallback(({ sendBack }) => {
            invokeCount += 1
            if (invokeCount === 1) {
                sendBack({
                    type: 'STRATEGY_ERROR',
                    error: {
                        kind: 'scan_timeout',
                        cause: new Error('timeout'),
                    },
                })
            }
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, {
            input: makeInput({ totalTxs: 3 }),
        })
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))

        actor.send({ type: 'RETRY' })
        const snap = actor.getSnapshot()
        expect(snap.matches('active')).toBe(true)
        expect(snap.context.error).toBeNull()
        expect(snap.context.currentTx).toBe(0)
    })

    it('USER_REJECTED_ON_DEVICE transitions to rejected', async () => {
        const stubActor = fromCallback(() => () => {})
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, { input: makeInput() })
        actor.start()
        actor.send({ type: 'USER_REJECTED_ON_DEVICE' })
        const snapshot = actor.getSnapshot()
        expect(snapshot.matches('rejected')).toBe(true)
        expect(snapshot.output).toEqual({ kind: 'rejected' })
    })

    it('PROGRESS updates currentTx', async () => {
        const stubActor = fromCallback(({ sendBack }) => {
            sendBack({ type: 'AWAITING_APPROVAL' })
            sendBack({ type: 'SIGNING_STARTED' })
            sendBack({ type: 'PROGRESS', current: 2, total: 5 })
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, {
            input: makeInput({ totalTxs: 5 }),
        })
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(actor.getSnapshot().context.currentTx).toBe(2)
        expect(actor.getSnapshot().matches({ active: 'signing' })).toBe(true)
    })

    describe('per-step inactivity timeout', () => {
        // The timeout is a PER-STEP inactivity budget, not a whole-session
        // budget: each device-interaction step (searching / awaiting a given
        // approval / signing a given tx) arms a fresh timer, so human-paced
        // multi-tx approval never trips it while a genuinely hung device
        // (no progress for the whole ceiling) still routes to the retryable
        // `error` state.
        const CEILING = 100

        // A hardwareSignActor that never emits any settling event — models a
        // hung hardware-signing step (device never responds) that would
        // otherwise pin the signing UI indefinitely.
        const makeHangingMachine = (timeoutMs: number) =>
            hardwareSigningMachine.provide({
                actors: {
                    hardwareSignActor: fromCallback(() => () => {}) as never,
                },
                delays: {
                    SEARCHING_TIMEOUT: timeoutMs,
                    APPROVAL_TIMEOUT: timeoutMs,
                },
            })

        it('times out a step with no activity and routes to error; RETRY re-enters active', async () => {
            const actor = createActor(makeHangingMachine(50), {
                input: makeInput(),
            })
            actor.start()

            const errored = await waitFor(actor, s => s.matches('error'), {
                timeout: 1000,
            })
            expect(errored.context.error?.kind).toBe('timeout')

            // The existing error→RETRY→active transition must handle the
            // synthetic timeout error like any other retryable failure.
            actor.send({ type: 'RETRY' })
            const retried = await waitFor(actor, s => s.matches('active'), {
                timeout: 1000,
            })
            expect(retried.matches('active')).toBe(true)
            expect(retried.context.error).toBeNull()
        })

        it('resets the budget on each progress/step event so multi-tx approval never trips it', () => {
            // Core fix: within a single group the actor re-fires
            // AWAITING_APPROVAL / PROGRESS per signable tx while sitting in the
            // `awaiting_approval` step. Each such event must re-arm the timer,
            // so only a full ceiling of genuine inactivity reaches `error`.
            vi.useFakeTimers()
            try {
                const actor = createActor(makeHangingMachine(CEILING), {
                    input: makeInput({ totalTxs: 3 }),
                })
                actor.start()

                // Enter the long-lived on-device approval step.
                actor.send({ type: 'AWAITING_APPROVAL' })
                expect(
                    actor
                        .getSnapshot()
                        .matches({ active: 'awaiting_approval' }),
                ).toBe(true)

                // Advance to just under the ceiling, then a progress event.
                vi.advanceTimersByTime(CEILING - 10)
                actor.send({ type: 'PROGRESS', current: 1, total: 3 })

                // Another near-ceiling wait: still active because the timer
                // was reset by the progress event (would already be `error`
                // under a single whole-session budget).
                vi.advanceTimersByTime(CEILING - 10)
                expect(actor.getSnapshot().matches('error')).toBe(false)
                expect(actor.getSnapshot().matches('active')).toBe(true)

                // The next tx's approval prompt re-arms the timer again.
                actor.send({ type: 'AWAITING_APPROVAL' })
                vi.advanceTimersByTime(CEILING - 10)
                expect(actor.getSnapshot().matches('active')).toBe(true)

                // Only a full ceiling of genuine inactivity trips it.
                vi.advanceTimersByTime(CEILING + 10)
                const snap = actor.getSnapshot()
                expect(snap.matches('error')).toBe(true)
                expect(snap.context.error?.kind).toBe('timeout')
            } finally {
                vi.useRealTimers()
            }
        })

        it('does not restart the invoked actor when progress events re-arm the timer', () => {
            // CRITICAL constraint: re-arming the per-step timer must NOT
            // re-invoke hardwareSignActor (that would tear down the in-flight
            // BLE session). Progress events re-enter a SUBSTATE of `active`,
            // never `active` itself, so the invoke count stays at 1 and the
            // accrued context is retained.
            let invokeCount = 0
            const fakeResult = {
                signedData: { type: 'transactions', signed: [] },
                signers: [],
            } as never
            const countingActor = fromCallback(() => {
                invokeCount += 1
                return () => {}
            })
            const machine = hardwareSigningMachine.provide({
                actors: { hardwareSignActor: countingActor as never },
                delays: { SEARCHING_TIMEOUT: 100, APPROVAL_TIMEOUT: 100 },
            })
            const actor = createActor(machine, {
                input: makeInput({ totalTxs: 3 }),
            })
            actor.start()
            expect(invokeCount).toBe(1)

            actor.send({ type: 'AWAITING_APPROVAL' })
            actor.send({ type: 'PROGRESS', current: 1, total: 3 })
            actor.send({ type: 'GROUP_SIGNED', result: fakeResult })
            actor.send({ type: 'AWAITING_APPROVAL' })
            actor.send({ type: 'PROGRESS', current: 2, total: 3 })

            expect(invokeCount).toBe(1)
            // Context accrued by progress is retained — no teardown/reset.
            expect(actor.getSnapshot().context.currentTx).toBe(2)
            expect(actor.getSnapshot().context.results).toEqual([fakeResult])
            expect(actor.getSnapshot().matches('active')).toBe(true)
        })

        it('does not fire the timeout when signing completes with ALL_DONE', async () => {
            // Regression: the `after` timer must be cancelled on exit from
            // `active` — a normal ALL_DONE reaches `done` without the timer
            // ever converting the result into a timeout error.
            const stubActor = fromCallback(({ sendBack }) => {
                sendBack({ type: 'ALL_DONE' })
                return () => {}
            })
            const machine = hardwareSigningMachine.provide({
                actors: { hardwareSignActor: stubActor as never },
                delays: { SEARCHING_TIMEOUT: 50, APPROVAL_TIMEOUT: 50 },
            })
            const actor = createActor(machine, {
                input: makeInput(),
            })
            actor.start()

            const done = await waitFor(actor, s => s.matches('done'), {
                timeout: 1000,
            })
            expect(done.context.error).toBeNull()
            expect(done.output).toEqual({ kind: 'success', results: [] })
        })
    })

    it('a single slow on-device approval is bounded only by the confirmation ceiling', () => {
        // A user scrolling a multi-screen app call can legitimately sit in
        // `awaiting_approval` for minutes with no activity events — the
        // machine must not tear the session down before the strategy's own
        // LEDGER_CONFIRMATION_TIMEOUT_MS bound has had its say.
        vi.useFakeTimers()
        try {
            const machine = hardwareSigningMachine.provide({
                actors: {
                    hardwareSignActor: fromCallback(() => () => {}) as never,
                },
            })
            const actor = createActor(machine, { input: makeInput() })
            actor.start()
            actor.send({ type: 'AWAITING_APPROVAL' })

            // Well past the old 35s per-step budget, still under the 300s
            // confirmation ceiling: the machine must still be waiting.
            vi.advanceTimersByTime(LEDGER_CONFIRMATION_TIMEOUT_MS - 60_000)
            expect(actor.getSnapshot().matches('active')).toBe(true)

            // The machine backstop (above the strategy ceiling) still bounds
            // a genuinely hung step where no STRATEGY_ERROR ever arrives.
            vi.advanceTimersByTime(120_000)
            const snap = actor.getSnapshot()
            expect(snap.matches('error')).toBe(true)
            expect(snap.context.error?.kind).toBe('timeout')
        } finally {
            vi.useRealTimers()
        }
    })

    it('RETRY after a partial multi-group success yields each group exactly once', async () => {
        const resultA = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: 'A' }],
        } as never
        const resultA2 = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: 'A2' }],
        } as never
        const resultB = {
            signedData: { type: 'transactions', signed: [] },
            signers: [{ address: 'B' }],
        } as never
        // First invocation signs group 1 then dies; the RETRY re-invocation
        // signs both groups. The stale group-1 result from the failed run
        // must not survive into the output.
        let invokeCount = 0
        const stubActor = fromCallback(({ sendBack }) => {
            invokeCount += 1
            if (invokeCount === 1) {
                sendBack({ type: 'GROUP_SIGNED', result: resultA })
                sendBack({
                    type: 'STRATEGY_ERROR',
                    error: {
                        kind: 'connection_failed',
                        cause: new Error('disconnected mid-group'),
                    },
                })
            } else {
                sendBack({ type: 'GROUP_SIGNED', result: resultA2 })
                sendBack({ type: 'GROUP_SIGNED', result: resultB })
                sendBack({ type: 'ALL_DONE' })
            }
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, { input: makeInput() })
        actor.start()
        await waitFor(actor, s => s.matches('error'), { timeout: 1000 })

        actor.send({ type: 'RETRY' })
        const done = await waitFor(actor, s => s.matches('done'), {
            timeout: 1000,
        })
        expect(done.output).toEqual({
            kind: 'success',
            results: [resultA2, resultB],
        })
    })

    it('NON_LEDGER_ERROR transitions directly to done with kind:error (bypasses BLE-class gate)', async () => {
        const stubActor = fromCallback(({ sendBack }) => {
            sendBack({
                type: 'NON_LEDGER_ERROR',
                error: {
                    kind: 'connection_failed',
                    cause: new Error('arc60 validation'),
                },
            })
            return () => {}
        })
        const machine = hardwareSigningMachine.provide({
            actors: { hardwareSignActor: stubActor as never },
        })
        const actor = createActor(machine, { input: makeInput() })
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))
        const snap = actor.getSnapshot()
        // Goes directly to done — does NOT sit in error waiting for ACK.
        expect(snap.matches('done')).toBe(true)
        expect(snap.output).toEqual({
            kind: 'error',
            error: {
                kind: 'connection_failed',
                cause: expect.any(Error),
            },
        })
    })
})
