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

// `waitFor` gives up after 1s by default. Steps that run real key derivation
// (Falcon keygen, BIP39 + xhd) need the whole per-test budget, which the
// integration project sets as `testTimeout`. Cloud-backup Argon2 is stubbed.
export const SLOW_WAIT_TIMEOUT_MS = 30_000

// A flow that saves and then verifies a PIN runs the 600k-iteration PBKDF2
// (twice per call, for the duress slot) on top of its other slow steps; on a
// loaded CI runner the sum outruns one `SLOW_WAIT_TIMEOUT_MS` budget.
export const PIN_FLOW_TEST_TIMEOUT_MS = 90_000
