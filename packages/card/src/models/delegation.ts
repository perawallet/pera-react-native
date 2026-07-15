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

import type { Decimal } from 'decimal.js'

/** Single-use pair from GET /v1/delegation/token, valid for ~10 minutes. */
export type CardDelegationToken = {
    token: string
    nonce: string
}

/**
 * A non-custodial wallet registered with Baanx via delegation
 * (GET /v1/wallet/external). `balance` and `allowance` are in display units;
 * an allowance of 0 means the delegation is inactive.
 */
export type CardExternalWallet = {
    address: string
    /** Currency code as Baanx sent it, e.g. "usdc". */
    currency: string
    balance: Decimal
    allowance: Decimal
    network: string
}

/** Signed delegated-LSig payload produced by the injected program signer. */
export type DelegationSignature = {
    /** msgpack-encoded signed LogicSig. */
    signedProgram: Uint8Array
}
