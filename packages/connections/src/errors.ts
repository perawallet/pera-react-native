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
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { DappRequestFailure } from './dappRequest'

export type ConnectionsErrorCode =
    | 'invalid-payload'
    | 'no-handler'
    | 'unsupported-chain'
    | 'unsupported-operation'
    | 'unauthorized-account'
    | 'unknown-connection'
    | 'duplicate-kind'
    | 'already-initialized'
    | 'already-answered'
    | 'no-subscriber'
    | 'not-initialized'

const MESSAGE_KEY_BY_CODE: Record<ConnectionsErrorCode, I18nKey> = {
    'invalid-payload': i18nKey('errors.connections.invalid_payload'),
    'no-handler': i18nKey('errors.connections.no_handler'),
    // A chain with no registered adapter is, from the peer's perspective, the
    // same "nobody can answer this" as no-handler; no new locale copy needed.
    'unsupported-chain': i18nKey('errors.connections.no_handler'),
    'unsupported-operation': i18nKey('errors.connections.no_handler'),
    'unauthorized-account': i18nKey('errors.connections.unauthorized_account'),
    'unknown-connection': i18nKey('errors.connections.unknown_connection'),
    'duplicate-kind': i18nKey('errors.connections.duplicate_kind'),
    'already-initialized': i18nKey('errors.connections.already_initialized'),
    'already-answered': i18nKey('errors.connections.already_answered'),
    'no-subscriber': i18nKey('errors.connections.no_subscriber'),
    'not-initialized': i18nKey('errors.connections.not_initialized'),
}

const FAILURE_BY_CODE: Partial<
    Record<ConnectionsErrorCode, DappRequestFailure>
> = {
    'invalid-payload': 'invalid-params',
    'unauthorized-account': 'unauthorized-account',
    'unsupported-operation': 'unsupported-method',
}

/**
 * `message` reaches the remote peer, so it must never carry wallet-private
 * data; the user sees `metadata.messageKey` via `resolveErrorCopy` instead.
 */
export class ConnectionsError extends AppError {
    public readonly code: ConnectionsErrorCode
    /** What a namespace maps to its own wire code; absent for a failure no dApp caused. */
    public readonly failure?: DappRequestFailure

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
        this.failure = FAILURE_BY_CODE[code]
    }
}

/**
 * A refusal whose wire code the chain picks, for codes no `DappRequestFailure`
 * names. The peer gets `wireCode`; the user-facing copy stays the invalid-payload one.
 */
export class DappRequestCodedError extends ConnectionsError {
    constructor(
        public readonly wireCode: number,
        message: string,
    ) {
        super('invalid-payload', message)
        this.name = 'DappRequestCodedError'
    }
}
