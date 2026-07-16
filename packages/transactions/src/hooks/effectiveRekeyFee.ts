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
 * The fee (µAlgo) a rekey transaction must carry: never below AlgoKit's
 * auto-sized fee for the built transaction (`max(minFee, feePerByte × size)`
 * under per-byte congestion pricing), never below the PQ-aware resolved
 * minimum for the effective signer.
 *
 * Both the display query (`useRekeyTransactionFeeQuery`) and the submit
 * mutation (`useSubmitRekeyMutation`) read this single rule so the fee the
 * user sees can never diverge from the fee that is paid.
 */
export const effectiveRekeyFee = (
    resolvedMinFee: bigint,
    builtFee: bigint,
): bigint => (resolvedMinFee > builtFee ? resolvedMinFee : builtFee)
