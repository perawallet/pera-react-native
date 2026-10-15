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

import {
    createChainAdapterRegistry,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { ErrorMessageKeys } from '../errors/base'

/** Copy for an error a chain's node raised, with `params` that may hold bigint. */
export type NodeErrorCopy = ErrorMessageKeys & {
    params: Readonly<Record<string, unknown>>
}

/** Registered by a chain package that can word its own nodes' errors. */
export interface NodeErrorsAdapter {
    readonly chainId: ChainId
    /** `undefined` when the chain can't improve on the caller's own copy for this error. */
    describeError(error: unknown): NodeErrorCopy | undefined
}

export const nodeErrorAdapters =
    createChainAdapterRegistry<NodeErrorsAdapter>('nodeErrors')

// An error doesn't carry the chain whose node raised it, so every chain is asked
// and each describes only errors it recognises as its own.
export const describeNodeError = (
    error: unknown,
): NodeErrorCopy | undefined => {
    for (const adapter of nodeErrorAdapters.list()) {
        const copy = adapter.describeError(error)
        if (copy) return copy
    }
    return undefined
}
