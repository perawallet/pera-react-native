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

/** `tokenId` is a decimal uint256; `amount` is a quantity in base units. */
export type EvmNftItem = { tokenId: string; amount: Decimal }

/**
 * A call to a standard token function, read from calldata that re-encodes to
 * exactly itself. Every `value` is a raw uint256 in base units. `approve` and
 * `transfer-from` share their selector between ERC-20 and ERC-721, so their
 * `value` may be an amount or a token id: only the token itself can say which.
 */
export type EvmStandardCall =
    | {
          kind: 'transfer'
          contract: Address
          /** The signer: `transfer` moves the caller's own tokens. */
          from: Address
          to: Address
          value: Decimal
      }
    | {
          kind: 'transfer-from'
          contract: Address
          from: Address
          to: Address
          value: Decimal
      }
    | {
          kind: 'erc721-safe-transfer'
          contract: Address
          from: Address
          to: Address
          tokenId: string
      }
    | {
          kind: 'erc1155-transfer'
          contract: Address
          from: Address
          to: Address
          items: EvmNftItem[]
      }
    | {
          kind: 'approve'
          contract: Address
          spender: Address
          value: Decimal
      }
    | {
          kind: 'increase-allowance'
          contract: Address
          spender: Address
          value: Decimal
      }
    | {
          kind: 'set-approval-for-all'
          contract: Address
          operator: Address
          isApproved: boolean
      }
