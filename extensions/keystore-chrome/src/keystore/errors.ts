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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 errors.ts
// Portions Copyright Algorand Foundation, Apache-2.0
//
// Only the four keystore error classes actually referenced by the vendored
// leaf helpers are ported. This file is separate from ../errors.ts, which
// owns the ten pre-existing vault errors — the two sets must not collide.

/**
 * Base error class for keystore operations.
 */
export class KeyStoreError extends Error {
    constructor(message: string, name: string, cause?: Error) {
        super(message)
        this.name = name
        if (cause) {
            this.cause = cause
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, KeyStoreError)
        }
    }
}

/**
 * Error thrown when a requested key cannot be found in the keystore.
 */
export class KeyNotFoundError extends KeyStoreError {
    /**
     * @param keyId - The ID of the key that was not found.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(keyId: string, cause?: Error) {
        super(`Key not found: ${keyId}`, 'KeyNotFoundError', cause)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, KeyNotFoundError)
        }
    }
}

/**
 * Error thrown when key data is provided in an invalid or unsupported format.
 */
export class InvalidKeyFormatError extends KeyStoreError {
    /**
     * @param format - The name of the invalid format.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(format: string, cause?: Error) {
        super(`Invalid key format: ${format}`, 'InvalidKeyFormatError', cause)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InvalidKeyFormatError)
        }
    }
}

/**
 * Error thrown when provided key data is malformed or invalid for the operation.
 */
export class InvalidKeyDataError extends KeyStoreError {
    /**
     * @param reason - A description of why the key data is invalid.
     * @param cause - The underlying error that caused this error, if any.
     */
    constructor(reason: string, cause?: Error) {
        super(`Invalid key data: ${reason}`, 'InvalidKeyDataError', cause)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InvalidKeyDataError)
        }
    }
}
