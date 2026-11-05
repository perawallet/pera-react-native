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
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { NameAddressVerification, NameServiceId } from './models'

export type VerifyForwardResolutionParams = {
    name: string
    address: string
    scope: ChainScope
    signal?: AbortSignal
}

/** What the name service needs from a chain; registered by the chain package. */
export interface NameServiceChainAdapter {
    chainId: ChainId
    /** The service whose names resolve to this chain's addresses. */
    service: NameServiceId
    isValidAddress(address: string): boolean
    /**
     * The form the service resolves `name` in, or `undefined` for a name it
     * refuses. Where set, search sends only names it accepts and keeps only
     * results whose name has the same form as the one asked about.
     */
    normalizeName?(name: string): Optional<string>
    /**
     * Checks a backend-asserted `name` → `address` against the chain's own
     * record of the name. Must throw on abort and return `unavailable`, not a
     * verdict, when the chain cannot be read.
     */
    verifyForwardResolution?(
        params: VerifyForwardResolutionParams,
    ): Promise<NameAddressVerification>
}

export const nameServiceChainAdapters =
    createChainAdapterRegistry<NameServiceChainAdapter>('name service')

export const nameServiceAdapterFor = (
    scope: ChainScope,
): NameServiceChainAdapter => nameServiceChainAdapters.get(scope.chainId)

export const nameServiceOf = (scope: ChainScope): NameServiceId =>
    nameServiceAdapterFor(scope).service
