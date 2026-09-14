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

// TODO(card): remove once Baanx ships `/v1/delegation/algorand/post-approval`
// (the contract in packages/card/src/api/delegation is assumed — see its SWAP
// POINT marker). Dev-only, installed behind `__DEV__` from App.tsx.

/**
 * Accepts a delegation approval. The token now comes from the REAL
 * `GET /v1/delegation/token`, so it is only checked for presence, not against
 * an issued set, and the allowance is not recorded here: the real
 * `GET /v1/wallet/external` is the source of truth for what Baanx knows.
 */
export const applyMockDelegation = (body: {
    address: string
    amount: string
    token: string
}): { success: boolean } => ({ success: body.token.length > 0 })
