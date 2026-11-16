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

/** A cut of the swap's output the router pays someone else before the signer is paid. */
export type EvmSwapFee = {
    /** Always the swap's output token. */
    token: Address
    recipient: Address
    size:
        | {
              kind: 'bips'
              /** The share of the router's balance of `token`, out of 10 000. */
              bips: number
          }
        | {
              kind: 'amount'
              /** Base units of `token`. */
              amount: Decimal
          }
}

export type EvmLiquidityDeposit = {
    asset: EvmActionAsset
    /** Base units: the most the position manager can take (`amountNDesired`), not what it will. */
    maxAmount: Decimal
}

export type EvmLiquidityPosition =
    | { kind: 'new' }
    /** `tokenId` is a decimal uint256. */
    | { kind: 'existing'; tokenId: string }

/** What a call to a known contract does, read from calldata that re-encodes to exactly itself. */
export type EvmContractAction =
    | {
          kind: 'swap'
          input: EvmSwapLeg
          output: EvmSwapLeg
          /** Empty unless a third party is paid out of the output. */
          fees: EvmSwapFee[]
      }
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
    | {
          kind: 'add-liquidity'
          /** In pool token order, at most two; empty on an increase, whose calldata doesn't name the tokens. */
          deposits: EvmLiquidityDeposit[]
          position: EvmLiquidityPosition
      }
    | {
          kind: 'remove-liquidity'
          /** A decimal uint256. */
          tokenId: string
          /** Set when the call also burns the position's NFT. */
          isClosing: boolean
      }

/** The part of a known contract the review carries. */
export type EvmContractLabel = Pick<
    KnownEvmContract,
    'kind' | 'name' | 'projectDomain'
>
