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
 * Thrown when fee delegation requires a valid app-integrity (device
 * attestation) token and none is available, so the request cannot proceed.
 * Callers own the user-facing wording for their flow.
 */
export class FeeDelegationAttestationRequiredError extends Error {
    constructor(
        message = 'Device verification is required for fee-delegated transactions.',
    ) {
        super(message)
        this.name = 'FeeDelegationAttestationRequiredError'
    }
}

/**
 * Thrown when the fee-delegation backend returns a to-sign slot that is not
 * byte-identical (modulo the re-assigned group field) to a transaction the
 * wallet actually sent, or whose sender is not the requesting account. A
 * non-custodial wallet must never sign a transaction it did not build, so the
 * whole group is rejected rather than signed — this is the substitution
 * trust-anchor for fee delegation.
 */
export class FeeDelegationResponseMismatchError extends Error {
    constructor(
        message = 'The fee-delegation server returned transactions that do not match the ones the wallet sent.',
    ) {
        super(message)
        this.name = 'FeeDelegationResponseMismatchError'
    }
}
