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

// Outer/inner split matters for fees: outer txns are signed by the claimer
// (PQ-aware rate), inner txns are dispatched by the router app (base rate).
/** Inner txns dispatched by arc59_claim (asset xfer + MBR refund). */
export const CLAIM_INNER_TX_COUNT = 2
/** Inner txns dispatched by arc59_reject (close-out to creator + MBR refund). */
export const REJECT_INNER_TX_COUNT = 2
/** Inner txns dispatched by arc59_claimAlgo. */
export const CLAIM_ALGO_INNER_TX_COUNT = 1
