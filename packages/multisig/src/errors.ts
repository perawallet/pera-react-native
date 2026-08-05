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
    AppError,
    ErrorCategory,
    type ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

export type MultisigValidationCode =
    | 'participant_is_multisig'
    | 'participant_is_watch'
    | 'threshold_exceeds_participants'

export class MultisigValidationError extends AppError {
    public readonly code: MultisigValidationCode

    constructor(
        code: MultisigValidationCode,
        message: string,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(message, {
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.VALIDATION,
            recoverable: true,
            retryable: false,
            ...metadata,
        })
        this.code = code
    }
}

export class ParticipantIsMultisigError extends MultisigValidationError {
    constructor() {
        super(
            'participant_is_multisig',
            'Cannot add a shared account as a participant.',
            {
                messageKey:
                    'multisig.add_participant.cannot_add_multisig_error_body',
            },
        )
    }
}

export class ParticipantIsWatchError extends MultisigValidationError {
    constructor() {
        super(
            'participant_is_watch',
            'Cannot add a watch account as a participant.',
            {
                messageKey:
                    'multisig.add_participant.cannot_add_watch_error_body',
            },
        )
    }
}

export class ThresholdExceedsParticipantsError extends MultisigValidationError {
    constructor(threshold: number, participantCount: number) {
        super(
            'threshold_exceeds_participants',
            `Threshold (${threshold}) cannot exceed participant count (${participantCount}).`,
            {
                messageKey: 'multisig.threshold.exceeds_participants',
                params: { threshold, participantCount },
            },
        )
    }
}
