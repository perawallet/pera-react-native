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
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

export type ConnectionsErrorCode =
    | 'invalid-payload'
    | 'no-handler'
    | 'unknown-connection'
    | 'duplicate-kind'
    | 'already-initialized'
    | 'already-answered'
    | 'no-subscriber'

const MESSAGE_KEY_BY_CODE: Record<ConnectionsErrorCode, string> = {
    'invalid-payload': 'errors.connections.invalid_payload',
    'no-handler': 'errors.connections.no_handler',
    'unknown-connection': 'errors.connections.unknown_connection',
    'duplicate-kind': 'errors.connections.duplicate_kind',
    'already-initialized': 'errors.connections.already_initialized',
    'already-answered': 'errors.connections.already_answered',
    'no-subscriber': 'errors.connections.no_subscriber',
}

/**
 * A registry or validation-boundary failure.
 *
 * `message` is developer English and is what reaches the remote peer (the
 * zod field-path breadcrumb, the failing kind); it must never carry
 * wallet-private data. What the USER sees comes from `metadata.messageKey`,
 * which `resolveErrorCopy` translates — an `AppError` without one falls back
 * to generic copy and its `message` stays log-only.
 */
export class ConnectionsError extends AppError {
    public readonly code: ConnectionsErrorCode

    constructor(
        code: ConnectionsErrorCode,
        message: string,
        originalError?: Error,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.CONNECTIONS,
                retryable: false,
                messageKey: MESSAGE_KEY_BY_CODE[code],
            },
            originalError,
        )
        this.code = code
    }
}
