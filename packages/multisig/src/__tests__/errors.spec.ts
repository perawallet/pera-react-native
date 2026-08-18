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
    MultisigValidationError,
    ParticipantIsMultisigError,
    ParticipantIsQuantumError,
    ParticipantIsWatchError,
    ThresholdExceedsParticipantsError,
} from '../errors'

describe('MultisigValidationError', () => {
    test('is an AppError with validation category', () => {
        const error = new ParticipantIsMultisigError()

        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(MultisigValidationError)
        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
        expect(error.metadata.severity).toBe(ErrorSeverity.LOW)
        expect(error.metadata.retryable).toBe(false)
    })
})

describe('ParticipantIsMultisigError', () => {
    test('has the participant_is_multisig code', () => {
        const error = new ParticipantIsMultisigError()

        expect(error.code).toBe('participant_is_multisig')
    })
})

describe('ParticipantIsWatchError', () => {
    test('has the participant_is_watch code', () => {
        const error = new ParticipantIsWatchError()

        expect(error.code).toBe('participant_is_watch')
    })
})

describe('ParticipantIsQuantumError', () => {
    test('has the participant_is_quantum code', () => {
        const error = new ParticipantIsQuantumError()

        expect(error.code).toBe('participant_is_quantum')
    })
})

describe('ThresholdExceedsParticipantsError', () => {
    test('has the threshold_exceeds_participants code and includes counts in message', () => {
        const error = new ThresholdExceedsParticipantsError(4, 3)

        expect(error.code).toBe('threshold_exceeds_participants')
        expect(error.message).toContain('4')
        expect(error.message).toContain('3')
    })
})

describe('multisig error copy', () => {
    test('ParticipantIsMultisigError declares the existing body key', () => {
        const error = new ParticipantIsMultisigError()

        expect(error.metadata.messageKey).toBe(
            'multisig.add_participant.cannot_add_multisig_error_body',
        )
    })

    test('ParticipantIsWatchError declares the existing body key', () => {
        const error = new ParticipantIsWatchError()

        expect(error.metadata.messageKey).toBe(
            'multisig.add_participant.cannot_add_watch_error_body',
        )
    })

    test('ParticipantIsQuantumError declares the quantum body key', () => {
        const error = new ParticipantIsQuantumError()

        expect(error.metadata.messageKey).toBe(
            'multisig.add_participant.cannot_add_quantum_error_body',
        )
    })

    test('ThresholdExceedsParticipantsError declares its key and both params', () => {
        const error = new ThresholdExceedsParticipantsError(4, 3)

        expect(error.metadata.messageKey).toBe(
            'multisig.threshold.exceeds_participants',
        )
        expect(error.metadata.params).toEqual({
            threshold: 4,
            participantCount: 3,
        })
    })
})

describe('discriminated union via code', () => {
    test('callers can narrow by code', () => {
        const errors: MultisigValidationError[] = [
            new ParticipantIsMultisigError(),
            new ParticipantIsWatchError(),
            new ParticipantIsQuantumError(),
            new ThresholdExceedsParticipantsError(2, 1),
        ]
        const codes = errors.map(e => e.code)

        expect(codes).toEqual([
            'participant_is_multisig',
            'participant_is_watch',
            'participant_is_quantum',
            'threshold_exceeds_participants',
        ])
    })
})
