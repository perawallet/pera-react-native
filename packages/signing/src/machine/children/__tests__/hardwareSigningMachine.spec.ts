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

import { describe, it, expect, vi } from 'vitest'
import { createActor, fromCallback, waitFor } from 'xstate'
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

    describe('active state timeout', () => {
        // A hardwareSignActor that never emits any settling event — models a
        // hung hardware-signing step (device never responds while searching /
        // awaiting approval) that would otherwise pin the signing UI
        // indefinitely. The `active`-state `after: { HARDWARE_TIMEOUT }` must
        // fire and route to the existing retryable `error` state.
        const makeHangingMachine = (timeoutMs: number) =>
            hardwareSigningMachine.provide({
                actors: {
                    hardwareSignActor: fromCallback(() => () => {}) as never,
                },
                delays: { HARDWARE_TIMEOUT: timeoutMs },
            })

        it('times out a hung active state and routes to error, RETRY re-enters active', async () => {
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
                delays: { HARDWARE_TIMEOUT: 50 },
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
