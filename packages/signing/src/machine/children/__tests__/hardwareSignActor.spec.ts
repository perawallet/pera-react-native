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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, setup } from 'xstate'
import { LedgerBluetoothDisabledError } from '@perawallet/wallet-core-ledger'

const mocks = vi.hoisted(() => ({
    sign: vi.fn(),
}))

vi.mock('../../../pipeline/signing/createHardwareStrategy', () => ({
    createHardwareStrategy: () => ({ sign: mocks.sign }),
}))

import { hardwareSignActor } from '../hardwareSignActor'
import type {
    HardwareSigningEvent,
    HardwareSigningInput,
} from '../hardwareSigningMachine.context'
import type {
    AnalyzedSignableGroup,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'
import type {
    HardwareWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

const HARDWARE_ADDRESS =
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH'

const OTHER_ADDRESS =
    'OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO'

const hardwareAccount = {
    type: 'hardware',
    address: HARDWARE_ADDRESS,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
} as unknown as HardwareWalletAccount

const nonHardwareAccount = {
    type: 'algo25',
    address: OTHER_ADDRESS,
    keyPairId: 'key-1',
} as unknown as WalletAccount

const makeGroup = (
    signerAddress: string = HARDWARE_ADDRESS,
): AnalyzedSignableGroup =>
    ({
        data: {
            type: 'transactions',
            transactions: [
                { sender: { toString: () => signerAddress } } as never,
            ],
            indicesToSign: [0],
        },
        source: { type: 'local' },
        signerAddress,
        originalIndices: [0],
        analysis: {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        },
    }) as AnalyzedSignableGroup

const makeResult = (): SigningResult =>
    ({
        signedData: { type: 'transactions', signed: [] },
        signers: [{ address: HARDWARE_ADDRESS }],
        originalIndices: [0],
    }) as SigningResult

const makeInput = (
    overrides: Partial<HardwareSigningInput> = {},
): HardwareSigningInput => ({
    groups: [makeGroup()],
    allAccounts: [hardwareAccount as unknown as WalletAccount],
    hardwareWalletRegistry: {} as never,
    encodeTransaction: vi.fn() as never,
    totalTxs: 1,
    deviceName: 'Nano X',
    operation: 'transaction',
    ...overrides,
})

/**
 * Spins up a minimal parent harness that captures every event the
 * `hardwareSignActor` sends back via `sendBack`. The harness is a leaf
 * machine whose sole purpose is to expose the actor's outgoing events
 * for assertion — we can't observe `sendBack` directly because it is
 * scoped to the parent actor.
 */
const runActor = async (
    input: HardwareSigningInput,
): Promise<{
    events: HardwareSigningEvent[]
    stop: () => void
}> => {
    const events: HardwareSigningEvent[] = []
    const harness = setup({
        types: {
            events: {} as HardwareSigningEvent | { type: '*' },
        },
        actors: { hardwareSignActor },
    }).createMachine({
        invoke: {
            src: 'hardwareSignActor',
            input,
        },
        on: {
            '*': {
                actions: ({ event }) => {
                    events.push(event as HardwareSigningEvent)
                },
            },
        },
    })
    const actor = createActor(harness)
    actor.start()
    // Flush microtasks so the strategy promise + sendBacks settle.
    await new Promise(resolve => setTimeout(resolve, 0))
    return {
        events,
        stop: () => actor.stop(),
    }
}

beforeEach(() => {
    mocks.sign.mockReset()
})

describe('hardwareSignActor', () => {
    it('happy path: awaiting-approval → signing-start → GROUP_SIGNED → ALL_DONE', async () => {
        mocks.sign.mockImplementation(
            async (
                _group: AnalyzedSignableGroup,
                _account: WalletAccount,
                callbacks: SigningCallbacks,
            ) => {
                callbacks.onPhaseChange?.('connecting')
                callbacks.onPhaseChange?.('awaiting-approval')
                callbacks.onSigningStart?.()
                return makeResult()
            },
        )

        const { events, stop } = await runActor(makeInput())
        stop()
        const types = events.map(e => e.type)
        expect(types).toContain('AWAITING_APPROVAL')
        expect(types).toContain('SIGNING_STARTED')
        expect(types).toContain('GROUP_SIGNED')
        expect(types).toContain('ALL_DONE')
        // AWAITING_APPROVAL must precede SIGNING_STARTED, and GROUP_SIGNED
        // must precede ALL_DONE.
        expect(types.indexOf('AWAITING_APPROVAL')).toBeLessThan(
            types.indexOf('SIGNING_STARTED'),
        )
        expect(types.indexOf('GROUP_SIGNED')).toBeLessThan(
            types.indexOf('ALL_DONE'),
        )
    })

    it('onPhaseChange with a non-approval phase is ignored (no sendBack)', async () => {
        mocks.sign.mockImplementation(
            async (_g, _a, callbacks: SigningCallbacks) => {
                // The actor only translates 'awaiting-approval'; every other
                // SigningPhase value should fall through silently.
                callbacks.onPhaseChange?.('connecting')
                callbacks.onPhaseChange?.('signing')
                return makeResult()
            },
        )

        const { events, stop } = await runActor(makeInput())
        stop()
        expect(events.some(e => e.type === 'AWAITING_APPROVAL')).toBe(false)
        // But the strategy still completed successfully — ALL_DONE arrives.
        expect(events.some(e => e.type === 'ALL_DONE')).toBe(true)
    })

    it('translates onProgress(current, total) into a PROGRESS event', async () => {
        mocks.sign.mockImplementation(
            async (_g, _a, callbacks: SigningCallbacks) => {
                callbacks.onProgress?.(2, 5)
                return makeResult()
            },
        )

        const { events, stop } = await runActor(makeInput())
        stop()
        const progress = events.find(e => e.type === 'PROGRESS') as Extract<
            HardwareSigningEvent,
            { type: 'PROGRESS' }
        >
        expect(progress).toBeDefined()
        expect(progress.current).toBe(2)
        expect(progress.total).toBe(5)
    })

    it('thrown non-Error (e.g. string) is wrapped into an Error and surfaces as NON_LEDGER_ERROR', async () => {
        mocks.sign.mockImplementation(() => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'bare string failure'
        })

        const { events, stop } = await runActor(makeInput())
        stop()
        const nonLedgerErrors = events.filter(
            e => e.type === 'NON_LEDGER_ERROR',
        )
        expect(nonLedgerErrors.length).toBeGreaterThan(0)
        const payload = nonLedgerErrors[0] as Extract<
            HardwareSigningEvent,
            { type: 'NON_LEDGER_ERROR' }
        >
        expect(payload.error.cause).toBeInstanceOf(Error)
        expect((payload.error.cause as Error).message).toContain(
            'bare string failure',
        )
    })

    it('Ledger error → STRATEGY_ERROR (gated by BLE-class teardown)', async () => {
        const ledgerError = new LedgerBluetoothDisabledError()
        mocks.sign.mockImplementation(
            async (_g, _a, callbacks: SigningCallbacks) => {
                callbacks.onError?.(ledgerError)
                throw ledgerError
            },
        )

        const { events, stop } = await runActor(makeInput())
        stop()
        const strategyErrors = events.filter(e => e.type === 'STRATEGY_ERROR')
        expect(strategyErrors.length).toBeGreaterThan(0)
        const payload = strategyErrors[0] as Extract<
            HardwareSigningEvent,
            { type: 'STRATEGY_ERROR' }
        >
        expect(payload.error.kind).toBe('bluetooth_disabled')
        expect(payload.error.cause).toBe(ledgerError)
        // Must NOT have fired NON_LEDGER_ERROR for a real Ledger error.
        expect(events.some(e => e.type === 'NON_LEDGER_ERROR')).toBe(false)
    })

    it('Non-Ledger plain Error → NON_LEDGER_ERROR (bypasses BLE-class gate)', async () => {
        const plainError = new Error('arc60 validation failed')
        mocks.sign.mockImplementation(
            async (_g, _a, callbacks: SigningCallbacks) => {
                callbacks.onError?.(plainError)
                throw plainError
            },
        )

        const { events, stop } = await runActor(makeInput())
        stop()
        const nonLedgerErrors = events.filter(
            e => e.type === 'NON_LEDGER_ERROR',
        )
        expect(nonLedgerErrors.length).toBeGreaterThan(0)
        // Plain Error is not a Ledger error class, so STRATEGY_ERROR must not fire.
        expect(events.some(e => e.type === 'STRATEGY_ERROR')).toBe(false)
        const payload = nonLedgerErrors[0] as Extract<
            HardwareSigningEvent,
            { type: 'NON_LEDGER_ERROR' }
        >
        expect(payload.error.cause).toBe(plainError)
    })

    it('offsets per-group progress so multi-group progress is monotonic', async () => {
        // The strategy reports progress per group (1..n each group); the
        // overlay total spans all groups. Without an offset, 2 groups × 2 txs
        // renders 1/4, 2/4, 1/4, 2/4 — progress going backwards.
        const twoTxGroup = (): AnalyzedSignableGroup => {
            const group = makeGroup()
            group.data = {
                ...group.data,
                transactions: [
                    { sender: { toString: () => HARDWARE_ADDRESS } } as never,
                    { sender: { toString: () => HARDWARE_ADDRESS } } as never,
                ],
                indicesToSign: [0, 1],
            } as never
            return group
        }
        mocks.sign.mockImplementation(
            async (_g, _a, callbacks: SigningCallbacks) => {
                callbacks.onProgress?.(1, 2)
                callbacks.onProgress?.(2, 2)
                return makeResult()
            },
        )

        const { events, stop } = await runActor(
            makeInput({ groups: [twoTxGroup(), twoTxGroup()], totalTxs: 4 }),
        )
        stop()

        const currents = events
            .filter(e => e.type === 'PROGRESS')
            .map(
                e =>
                    (e as Extract<HardwareSigningEvent, { type: 'PROGRESS' }>)
                        .current,
            )
        expect(currents).toEqual([1, 2, 3, 4])
    })

    it('iterates multiple groups, firing GROUP_SIGNED per success then ALL_DONE', async () => {
        mocks.sign.mockResolvedValue(makeResult())

        const { events, stop } = await runActor(
            makeInput({
                groups: [makeGroup(), makeGroup(), makeGroup()],
            }),
        )
        stop()

        const groupSigned = events.filter(e => e.type === 'GROUP_SIGNED')
        expect(groupSigned).toHaveLength(3)
        expect(mocks.sign).toHaveBeenCalledTimes(3)
        // ALL_DONE arrives after all GROUP_SIGNED events.
        const types = events.map(e => e.type)
        expect(types.lastIndexOf('GROUP_SIGNED')).toBeLessThan(
            types.indexOf('ALL_DONE'),
        )
    })

    it('signer not in allAccounts → throws HardwareWalletError(signer_not_found) → NON_LEDGER_ERROR', async () => {
        const { events, stop } = await runActor(
            makeInput({
                allAccounts: [], // signer cannot be resolved
            }),
        )
        stop()

        // The strategy must not even be invoked.
        expect(mocks.sign).not.toHaveBeenCalled()
        const nonLedgerErrors = events.filter(
            e => e.type === 'NON_LEDGER_ERROR',
        )
        expect(nonLedgerErrors.length).toBeGreaterThan(0)
    })

    it('resolved signing account is not a hardware wallet → NON_LEDGER_ERROR', async () => {
        // signerAddress maps to a non-hardware account in allAccounts.
        const { events, stop } = await runActor(
            makeInput({
                groups: [makeGroup(OTHER_ADDRESS)],
                allAccounts: [nonHardwareAccount],
            }),
        )
        stop()

        expect(mocks.sign).not.toHaveBeenCalled()
        const nonLedgerErrors = events.filter(
            e => e.type === 'NON_LEDGER_ERROR',
        )
        expect(nonLedgerErrors.length).toBeGreaterThan(0)
    })

    it('stopping the actor aborts the in-flight strategy signal', async () => {
        // The abort must reach the strategy (which disconnects the transport)
        // — the `cancelled` flag alone leaves the BLE exchange running
        // detached, walking the user through approvals that get discarded.
        let capturedSignal: AbortSignal | undefined
        mocks.sign.mockImplementation((_g, _a, callbacks: SigningCallbacks) => {
            capturedSignal = callbacks.signal
            return new Promise<SigningResult>(() => {})
        })

        const { stop } = await runActor(makeInput())
        expect(capturedSignal).toBeDefined()
        expect(capturedSignal!.aborted).toBe(false)

        stop()

        expect(capturedSignal!.aborted).toBe(true)
    })

    it('cleanup suppresses late phase/progress/error callbacks fired after stop', async () => {
        // Stash the callbacks so we can fire them AFTER the actor stops to
        // exercise every `if (cancelled) return` early-return branch.
        let storedCallbacks: SigningCallbacks | null = null
        mocks.sign.mockImplementation((_g, _a, callbacks: SigningCallbacks) => {
            storedCallbacks = callbacks
            return new Promise<SigningResult>(() => {})
        })

        const events: HardwareSigningEvent[] = []
        const harness = setup({
            types: { events: {} as HardwareSigningEvent | { type: '*' } },
            actors: { hardwareSignActor },
        }).createMachine({
            invoke: { src: 'hardwareSignActor', input: makeInput() },
            on: {
                '*': {
                    actions: ({ event }) => {
                        events.push(event as HardwareSigningEvent)
                    },
                },
            },
        })
        const actor = createActor(harness)
        actor.start()
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(storedCallbacks).not.toBeNull()
        const eventsBeforeStop = events.length

        actor.stop()

        // Fire each callback post-cancellation — every one should be a no-op.
        storedCallbacks!.onPhaseChange?.('connecting')
        storedCallbacks!.onPhaseChange?.('awaiting-approval')
        storedCallbacks!.onSigningStart?.()
        storedCallbacks!.onProgress?.(1, 1)
        storedCallbacks!.onError?.(new Error('late error'))
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(events.length).toBe(eventsBeforeStop)
    })

    it('cleanup suppresses in-flight sendBack — late strategy resolution does not fire GROUP_SIGNED', async () => {
        let resolveSign: (value: SigningResult) => void = () => {}
        mocks.sign.mockImplementation(
            () =>
                new Promise<SigningResult>(resolve => {
                    resolveSign = resolve
                }),
        )

        const events: HardwareSigningEvent[] = []
        const harness = setup({
            types: { events: {} as HardwareSigningEvent | { type: '*' } },
            actors: { hardwareSignActor },
        }).createMachine({
            invoke: { src: 'hardwareSignActor', input: makeInput() },
            on: {
                '*': {
                    actions: ({ event }) => {
                        events.push(event as HardwareSigningEvent)
                    },
                },
            },
        })
        const actor = createActor(harness)
        actor.start()
        // Stop the actor before the strategy promise resolves — this triggers
        // the actor's cleanup function which sets the `cancelled` flag.
        actor.stop()
        // Now resolve the strategy promise; the actor's post-resolve
        // sendBack must be suppressed by the cancelled flag.
        resolveSign(makeResult())
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(events.some(e => e.type === 'GROUP_SIGNED')).toBe(false)
        expect(events.some(e => e.type === 'ALL_DONE')).toBe(false)
    })
})
