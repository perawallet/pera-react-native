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

import { Decimal } from 'decimal.js'

/**
 * Max USD Baanx auto-funds per card transaction; also sent as the delegation
 * allowance. SWAP POINT: value and semantics TBC with Baanx (~300–400 USD).
 * Today this cap is a plaintext POST field, not bound into the signed program —
 * binding it is a required unblock, tracked in api/delegation/verify.ts.
 */
export const AUTO_FUNDING_PER_TX_LIMIT_USD = new Decimal(400)

/**
 * How the card is topped up, chosen on the onboarding setup checklist's
 * "Select Funding Type" step. `Auto` tops the card up from the connected Pera
 * account automatically; `Manual` leaves the user to add funds themselves.
 */
export const FundingType = {
    Auto: 'AUTO',
    Manual: 'MANUAL',
} as const
export type FundingType = (typeof FundingType)[keyof typeof FundingType]
