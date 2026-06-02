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

export class LiquidAuthServiceUnavailableError extends Error {
    constructor() {
        super('Liquid Auth service is not composed into the provider')
        this.name = 'LiquidAuthServiceUnavailableError'
    }
}

export class LiquidAuthConnectionError extends Error {
    readonly retryable: boolean
    constructor(message: string, retryable = true) {
        super(message)
        this.name = 'LiquidAuthConnectionError'
        this.retryable = retryable
    }
}

/**
 * Thrown by `connect` when the user rejects the connection at the confirm
 * step. Distinct from `LiquidAuthConnectionError` so the UI dismisses silently
 * (a user action, not a failure) — matching WalletConnect's reject behavior.
 */
export class LiquidAuthRejectedError extends Error {
    constructor() {
        super('Liquid Auth connection rejected by user')
        this.name = 'LiquidAuthRejectedError'
    }
}
