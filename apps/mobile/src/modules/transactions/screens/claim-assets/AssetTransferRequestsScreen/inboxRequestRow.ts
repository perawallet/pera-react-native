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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'

export type InboxRequestRow =
    | { kind: 'header'; key: string; chainId: ChainId }
    /** A request the inbox backend holds, claimed or rejected by transaction. */
    | {
          kind: 'claim'
          key: string
          scope: ChainScope
          request: AssetInboxRequest
          index: number
      }
    /** A token waiting on the device, accepted or rejected without one. */
    | {
          kind: 'token'
          key: string
          scope: ChainScope
          address: string
          asset: PeraAsset
          /** Display units. */
          amount: Decimal
          usdPrice: Nullable<Decimal>
      }

export type ClaimRow = Extract<InboxRequestRow, { kind: 'claim' }>
export type TokenRow = Extract<InboxRequestRow, { kind: 'token' }>
export type SelectableRow = ClaimRow | TokenRow

export const isSelectable = (row: InboxRequestRow): row is SelectableRow =>
    row.kind !== 'header'
