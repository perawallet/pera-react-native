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

export class VaultLockedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'VaultLockedError'
    }
}

export class VaultExistsError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'VaultExistsError'
    }
}

export class VaultNotInitializedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'VaultNotInitializedError'
    }
}

export class InvalidPasswordError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidPasswordError'
    }
}

export class VaultCorruptedError extends Error {
    constructor() {
        super('Vault data is corrupted or has an unsupported format.')
        this.name = 'VaultCorruptedError'
    }
}

export class VaultLockedOutError extends Error {
    constructor(readonly remainingSeconds: number) {
        super('Vault unlock is temporarily locked out')
        this.name = 'VaultLockedOutError'
    }
}

// Ported from @algorandfoundation/react-native-keystore@1.0.0-canary.12 errors.ts

/**
 * Decoding failed.
 */
export class DecodingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message)
        this.name = 'DecodingError'
        if (cause) {
            this.cause = cause
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecodingError)
        }
    }
}

export class EncodingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message)
        this.name = 'EncodingError'
        if (cause) {
            this.cause = cause
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EncodingError)
        }
    }
}

export class UnlockingError extends Error {
    constructor(message: string, cause?: Error) {
        super(message)
        this.name = 'UnlockingError'
        if (cause) {
            this.cause = cause
        }
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UnlockingError)
        }
    }
}

export class PasskeyUnlockError extends Error {
    constructor() {
        super('Passkey unlock failed: authentication tag mismatch.')
        this.name = 'PasskeyUnlockError'
    }
}
