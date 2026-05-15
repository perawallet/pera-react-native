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

import {
    AppError,
    ErrorCategory,
    ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Base walletconnect error
 */
export class WalletConnectError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.WALLETCONNECT,
                retryable: false,
                ...metadata,
            },
            originalError,
        )
    }
}

export class WalletConnectInvalidSessionError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(message ?? 'The session was missing or invalid.', originalError)
    }
}

export class WalletConnectSignRequestError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ?? 'An error has occurred during the signing process.',
            originalError,
        )
    }
}

export class WalletConnectPermissionError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(message ?? 'Permission denied', originalError)
    }
}

export class WalletConnectInvalidNetworkError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "The network doesn't match with the network your app is currently connected to.",
            originalError,
        )
    }
}

/**
 * The WalletConnect bridge socket could not be (re)opened in time to
 * deliver a signed payload to the dApp.
 *
 * WalletConnect v1's socket transport silently queues outgoing messages
 * when its WebSocket is down (no throw, no callback), so a signed
 * transaction handed back over a dead socket is lost while the UI still
 * reports success. The connector registry recreates a fresh socket and
 * throws this error if it cannot open in time — making the signing
 * pipeline surface an honest failure instead. Marked `retryable` so the
 * signing machine offers a Retry: a later attempt often lands once the
 * socket reconnects.
 */
export class WalletConnectConnectionTimeoutError extends WalletConnectError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ??
                "Couldn't reach WalletConnect to deliver your signed transaction. Check your connection and try again.",
            originalError,
            { retryable: true },
        )
    }
}
