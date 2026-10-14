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
import type {
    AssetRef,
    ChainActionData,
    ChainId,
    ChainPaymentData,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'

export type ChainLinkTarget = {
    chainId: ChainId
    /** Set only when the link names a network. */
    networkId?: NetworkId
}

export type DeeplinkParseFailure =
    | 'malformed'
    | 'unsupported-network'
    | 'unsupported-action'

export type DeeplinkParseResult =
    | { ok: true; intent: ChainDeeplinkIntent }
    | { ok: false; reason: DeeplinkParseFailure }

export type ChainDeeplinkIntent =
    | {
          kind: 'address'
          target: ChainLinkTarget
          address: string
          label?: string
      }
    | {
          kind: 'payment'
          target: ChainLinkTarget
          recipient: string
          assetRef?: AssetRef
          /** Base units of the asset. */
          amount?: Decimal
          label?: string
          note?: string
          chainData?: ChainPaymentData
      }
    | {
          kind: 'asset-opt-in'
          target: ChainLinkTarget
          assetRef: AssetRef
          address?: string
      }
    | { kind: 'explorer'; target: ChainLinkTarget; url: string }
    | { kind: 'wallet-connect'; uri: string }
    | {
          kind: 'chain-action'
          target: ChainLinkTarget
          chainData: ChainActionData
      }

export type ChainDeeplinkResolution =
    | {
          status: 'resolved'
          intents: readonly [ChainDeeplinkIntent, ...ChainDeeplinkIntent[]]
      }
    | {
          status: 'failed'
          chainId: ChainId
          reason: DeeplinkParseFailure | 'chain-unavailable'
      }
    | { status: 'unrecognised' }
