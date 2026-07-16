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

import { describe, test, expect } from 'vitest'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'
import {
    deriveStage,
    isRetryableError,
    derivePrimarySignerType,
    deriveEvent,
} from '../utils'
import type { MachineSnapshot } from '../types'
import type { PipelineStage } from '../../models'

const makeSnapshot = (
    matchesMap: Record<string, boolean>,
    context: Record<string, unknown> = {},
): MachineSnapshot =>
    ({
        matches: (state: string) => matchesMap[state] === true,
        context,
    }) as unknown as MachineSnapshot

describe('deriveStage', () => {
    test.each([
        ['completed', 'completed' as PipelineStage],
        ['rejected', 'rejected' as PipelineStage],
        ['failed', 'failed' as PipelineStage],
        ['transporting', 'transporting' as PipelineStage],
        ['signing', 'signing' as PipelineStage],
        ['awaiting_user', 'awaiting_user' as PipelineStage],
        ['validating', 'validating' as PipelineStage],
        ['idle', 'idle' as PipelineStage],
    ])('maps state %s to stage %s', (state, expected) => {
        expect(deriveStage(makeSnapshot({ [state]: true }))).toBe(expected)
    })

    test('falls back to idle when no states match', () => {
        expect(deriveStage(makeSnapshot({}))).toBe('idle')
    })
})

describe('isRetryableError', () => {
    test('returns false for null error', () => {
        expect(isRetryableError(null)).toBe(false)
    })

    test('returns false for a non-AppError Error', () => {
        expect(isRetryableError(new Error('plain'))).toBe(false)
    })

    test('returns true when AppError metadata.retryable is true', () => {
        const err = new AppError('boom', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.TRANSACTIONS,
            retryable: true,
        })
        expect(isRetryableError(err)).toBe(true)
    })

    test('returns false when AppError metadata.retryable is false', () => {
        const err = new AppError('boom', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.TRANSACTIONS,
            retryable: false,
        })
        expect(isRetryableError(err)).toBe(false)
    })
})

describe('derivePrimarySignerType', () => {
    const makeContext = (types: string[]) =>
        ({
            groupSignerTypes: new Map(types.map((t, i) => [`g${i}`, t])),
        }) as never

    test('returns null when groupSignerTypes is absent', () => {
        expect(derivePrimarySignerType({} as never)).toBeNull()
    })

    test('prefers hardware over multisig and localKey', () => {
        expect(
            derivePrimarySignerType(
                makeContext(['localKey', 'hardware', 'multisig']),
            ),
        ).toBe('hardware')
    })

    test('prefers multisig over localKey', () => {
        expect(
            derivePrimarySignerType(makeContext(['localKey', 'multisig'])),
        ).toBe('multisig')
    })

    test('returns localKey when only localKey present', () => {
        expect(derivePrimarySignerType(makeContext(['localKey']))).toBe(
            'localKey',
        )
    })

    test('returns null when no known types present', () => {
        expect(derivePrimarySignerType(makeContext(['weird']))).toBeNull()
    })
})

describe('deriveEvent', () => {
    test('returns analysis_ready event for awaiting_user when analysis exists', () => {
        const snapshot = makeSnapshot(
            { awaiting_user: true },
            {
                analyses: [{ totalFees: 0n } as never],
                groupSignerTypes: new Map([['g0', 'localKey']]),
            },
        )

        const event = deriveEvent(snapshot, 'awaiting_user')
        expect(event?.type).toBe('analysis_ready')
    })

    test('returns null for awaiting_user without analysis', () => {
        const snapshot = makeSnapshot({ awaiting_user: true }, { analyses: [] })
        expect(deriveEvent(snapshot, 'awaiting_user')).toBeNull()
    })

    test('returns signing_started event when signer type resolved', () => {
        const snapshot = makeSnapshot(
            { signing: true },
            { groupSignerTypes: new Map([['g0', 'hardware']]) },
        )

        const event = deriveEvent(snapshot, 'signing')
        expect(event).toEqual({
            type: 'signing_started',
            signerType: 'hardware',
        })
    })

    test('returns null for signing when signer type unresolved', () => {
        const snapshot = makeSnapshot({ signing: true }, {})
        expect(deriveEvent(snapshot, 'signing')).toBeNull()
    })

    test('returns transport_started for transporting', () => {
        expect(deriveEvent(makeSnapshot({}), 'transporting')).toEqual({
            type: 'transport_started',
        })
    })

    test('returns signing_completed when transportResult exists', () => {
        const tr = { type: 'submitted', txIds: ['tx'] } as never
        const snapshot = makeSnapshot({}, { transportResult: tr })
        expect(deriveEvent(snapshot, 'completed')).toEqual({
            type: 'signing_completed',
            transportResult: tr,
        })
    })

    test('returns null for completed without transportResult', () => {
        expect(deriveEvent(makeSnapshot({}, {}), 'completed')).toBeNull()
    })

    test('returns signing_rejected for rejected stage', () => {
        expect(deriveEvent(makeSnapshot({}), 'rejected')).toEqual({
            type: 'signing_rejected',
        })
    })

    test('returns signing_failed event with retryable flag', () => {
        const retryableErr = new AppError('boom', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.TRANSACTIONS,
            retryable: true,
        })
        const snapshot = makeSnapshot(
            {},
            { error: retryableErr, failedDuringState: 'signing' },
        )
        const event = deriveEvent(snapshot, 'failed')
        expect(event?.type).toBe('signing_failed')
        if (event?.type === 'signing_failed') {
            expect(event.isRetryable).toBe(true)
            expect(event.failedDuringState).toBe('signing')
        }
    })

    test('returns signing_failed with default error when context.error is null', () => {
        const snapshot = makeSnapshot({}, { error: null })
        const event = deriveEvent(snapshot, 'failed')
        expect(event?.type).toBe('signing_failed')
        if (event?.type === 'signing_failed') {
            expect(event.error.message).toBe('Unknown signing error')
            expect(event.isRetryable).toBe(false)
        }
    })

    test('returns null for idle and validating stages', () => {
        const snapshot = makeSnapshot({}, {})
        expect(deriveEvent(snapshot, 'idle')).toBeNull()
        expect(deriveEvent(snapshot, 'validating')).toBeNull()
    })
})
