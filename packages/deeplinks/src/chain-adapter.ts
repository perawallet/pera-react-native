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
    type AssetRef,
    type ChainActionData,
    type ChainAdapterRegistry,
    type ChainId,
    type ChainScope,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { DeeplinkParseResult } from './models'

export interface DeeplinkChainAdapter {
    readonly chainId: ChainId
    /** Lowercase, without the `:`. No two registered adapters share one. */
    readonly schemes: readonly string[]
    /** Cheap and side-effect free; true only for text in one of `schemes`. */
    canParse(input: string): boolean
    /** Never throws; text that `canParse` declines is `malformed`. */
    parse(input: string): DeeplinkParseResult
    /** Maps a chain-native asset id as a link spells it, or `undefined`. Never throws. */
    toAssetRef(raw: string): Optional<AssetRef>
    /**
     * Builds the transaction a `chain-action` intent asks for; required of a
     * chain whose `parse` produces one. Throws {@link ChainActionBuildError}
     * when the link's fields can't make a transaction.
     */
    buildChainAction?(
        chainData: ChainActionData,
        ctx: { scope: ChainScope },
    ): Promise<UnsignedTransaction>
}

export type ChainActionBuildFailure = 'missing-fields'

/** The link, not the network, is at fault: retrying the same link fails the same way. */
export class ChainActionBuildError extends AppError {
    readonly reason: ChainActionBuildFailure

    constructor(reason: ChainActionBuildFailure, message: string) {
        super(message, {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            recoverable: false,
            // A malformed link from a third party, not a wallet fault.
            expected: true,
            params: { reason },
        })
        this.reason = reason
    }
}

export class DuplicateDeeplinkSchemeError extends Error {
    readonly scheme: string
    /** The chain that already claims `scheme`. */
    readonly owner: ChainId
    /** The chain whose adapter was refused. */
    readonly chainId: ChainId

    constructor(scheme: string, owner: ChainId, chainId: ChainId) {
        super(
            `Deeplink scheme "${scheme}" is already claimed by chain "${owner}", so chain "${chainId}" cannot register it`,
        )
        this.name = 'DuplicateDeeplinkSchemeError'
        this.scheme = scheme
        this.owner = owner
        this.chainId = chainId
    }
}

const inner = createChainAdapterRegistry<DeeplinkChainAdapter>('deeplink')

export const deeplinkAdapters: ChainAdapterRegistry<DeeplinkChainAdapter> = {
    ...inner,
    register: adapter => {
        // An already-registered chain is the inner registry's call (repeat
        // bootstrap is a no-op, a different instance throws), not a scheme clash.
        if (inner.has(adapter.chainId)) {
            inner.register(adapter)
            return
        }
        for (const other of inner.list()) {
            const scheme = adapter.schemes.find(s => other.schemes.includes(s))
            if (scheme !== undefined) {
                throw new DuplicateDeeplinkSchemeError(
                    scheme,
                    other.chainId,
                    adapter.chainId,
                )
            }
        }
        inner.register(adapter)
    },
}

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/

/** Does not trim: a leading space is not a scheme. */
export const uriSchemeOf = (input: string): Optional<string> =>
    SCHEME.exec(input)?.[1].toLowerCase()
