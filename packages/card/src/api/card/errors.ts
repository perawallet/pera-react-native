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

/**
 * Thrown when `POST /v1/card/order` is refused because the user's KYC is not
 * VERIFIED yet (Baanx `USER_NOT_VERIFIED`). Recoverable: issuance simply has
 * to wait for the KYC decision, so callers treat it as "still pending", not
 * as a failed order. Callers own the user-facing wording for their flow.
 */
export class CardOrderNotVerifiedError extends Error {
    constructor(
        message = 'Identity verification must be approved before a card can be issued.',
    ) {
        super(message)
        this.name = 'CardOrderNotVerifiedError'
    }
}
