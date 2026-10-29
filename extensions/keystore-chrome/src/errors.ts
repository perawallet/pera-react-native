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

import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'

export class VaultLockedError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.KMS })
        this.name = 'VaultLockedError'
    }
}

export class VaultExistsError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.KMS })
        this.name = 'VaultExistsError'
    }
}

export class VaultNotInitializedError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.KMS })
        this.name = 'VaultNotInitializedError'
    }
}

export class InvalidPasswordError extends AppError {
    constructor(message: string) {
        super(message, { category: ErrorCategory.KMS })
        this.name = 'InvalidPasswordError'
    }
}

export class VaultCorruptedError extends AppError {
    constructor() {
        super('Vault data is corrupted or has an unsupported format.', {
            category: ErrorCategory.KMS,
        })
        this.name = 'VaultCorruptedError'
    }
}

export class VaultLockedOutError extends AppError {
    constructor(readonly remainingSeconds: number) {
        super('Vault unlock is temporarily locked out', {
            category: ErrorCategory.KMS,
        })
        this.name = 'VaultLockedOutError'
    }
}

export class PasskeyUnlockError extends AppError {
    constructor() {
        super('Passkey unlock failed: authentication tag mismatch.', {
            category: ErrorCategory.KMS,
        })
        this.name = 'PasskeyUnlockError'
    }
}
