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
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

// Lives apart from arc60.ts because the SIWA parser (siwa.ts) throws it too;
// keeping it here avoids a siwa -> arc60 -> siwa import cycle.
/** ERROR_BAD_JSON — AUTH-scope payload is not valid / canonical SIWA JSON. */
export class Arc60BadJsonError extends AppError {
    constructor(reason: string, originalError?: Error) {
        super(
            `ARC-60 AUTH payload is not a valid canonical SIWA JSON: ${reason}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.VALIDATION,
                recoverable: false,
                params: { reason },
            },
            originalError,
        )
    }
}
