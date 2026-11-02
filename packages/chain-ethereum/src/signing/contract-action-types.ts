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
import type { Address } from 'viem'
import type { KnownEvmContract } from './known-contracts'

export type EvmActionAsset =
    | { kind: 'native' }
    | { kind: 'token'; contract: Address }

export type EvmSwapLeg = {
    asset: EvmActionAsset
    /** Base units. */
    amount: Decimal
    /** `at-most` and `at-least` are the limits the calldata sets; `exact` is the amount it moves. */
    bound: 'exact' | 'at-most' | 'at-least'
}

/** What a call to a known contract does, read from calldata that re-encodes to exactly itself. */
export type EvmContractAction =
    | { kind: 'swap'; input: EvmSwapLeg; output: EvmSwapLeg }
    | {
          kind: 'wrap' | 'unwrap'
          /** Wei. */
          amount: Decimal
      }
    | {
          kind: 'supply' | 'withdraw' | 'borrow' | 'repay'
          asset: Address
          /** Base units of `asset`; the largest uint256 when `isEntireBalance`. */
          amount: Decimal
          /** Set when the call asks for the whole balance or debt. */
          isEntireBalance: boolean
      }

/** The part of a known contract the review carries. */
export type EvmContractLabel = Pick<
    KnownEvmContract,
    'kind' | 'name' | 'projectDomain'
>
