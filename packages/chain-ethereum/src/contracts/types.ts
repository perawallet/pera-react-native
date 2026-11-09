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
import type { Address, Hex } from 'viem'

/** What the backend knows about a contract's source. */
export type EvmContractAbiAnswer =
    | {
          status: 'verified'
          /** Raw ABI items; only well-formed function items are ever read. */
          abi: readonly unknown[]
          /** Set when the target is a proxy: `abi` is then its implementation's. */
          proxy?: { implementation: Address }
      }
    | { status: 'unverified' }
    /** The scope offers no lookup; nothing failed. */
    | { status: 'unavailable' }

export type EvmVerifiedAbi = Extract<
    EvmContractAbiAnswer,
    { status: 'verified' }
>

export type EvmAbiValue =
    | { kind: 'address'; value: Address }
    /** The raw integer the calldata encodes: an ABI never says what unit it counts. */
    | { kind: 'integer'; value: Decimal }
    | { kind: 'bool'; value: boolean }
    /** `bytes`/`bytesN`, and a `string` that isn't safely printable, as its UTF-8 bytes. */
    | { kind: 'bytes'; value: Hex }
    | { kind: 'string'; value: string }
    | { kind: 'array'; items: EvmAbiValue[] }
    | { kind: 'tuple'; fields: EvmAbiArgument[] }

export type EvmAbiArgument = {
    /** Absent when the ABI leaves the parameter unnamed. */
    name?: string
    type: string
    value: EvmAbiValue
}

/** A call read from calldata that re-encodes to exactly itself under the contract's verified ABI. */
export type EvmVerifiedCall = {
    functionName: string
    /** Canonical, e.g. `transfer(address,uint256)`. */
    signature: string
    arguments: EvmAbiArgument[]
    /** Set when the target is a proxy: the name is its implementation's. */
    proxy?: { implementation: Address }
}
