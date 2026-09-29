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
    type Network,
} from '@perawallet/wallet-core-shared'

/** The on-chain ids the escrow card flows need are missing from the build. */
export class CardEscrowNotConfiguredError extends AppError {
    constructor() {
        super('Pera Card chain config is incomplete (app ids / asset id)', {
            category: ErrorCategory.BLOCKCHAIN,
            recoverable: false,
        })
        this.name = 'CardEscrowNotConfiguredError'
    }
}

/** The bundled AutoDraw template does not match the build-time pin. */
export class AutoDrawTealUnverifiedError extends AppError {
    constructor() {
        super('AutoDraw TEAL template does not match the pinned hash', {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.BLOCKCHAIN,
            recoverable: false,
        })
        this.name = 'AutoDrawTealUnverifiedError'
    }
}

/** The compiled AutoDraw program doesn't match the network's pinned hash. */
export class AutoDrawProgramUnverifiedError extends AppError {
    constructor(network: Network) {
        super(
            `AutoDraw program for ${network} does not match the pinned hash`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                recoverable: false,
                params: { network },
            },
        )
        this.name = 'AutoDrawProgramUnverifiedError'
    }
}
