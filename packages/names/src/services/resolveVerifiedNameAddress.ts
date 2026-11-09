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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchNameSearch } from '../api'
import type { NameSearchResult } from '../models'
import { verifyNameAddress } from './verifyNameAddress'

export type VerifiedNameResolution =
    | { status: 'verified'; address: string }
    | { status: 'not-found' }
    | { status: 'mismatch' }
    | { status: 'unavailable' }

export type ResolveVerifiedNameAddressParams = {
    name: string
    scope: ChainScope
    signal?: AbortSignal
}

/**
 * Resolves `name` through the backend, then checks the answer on-chain, so
 * only a `verified` address may become a destination.
 * @throws AbortError when `signal` aborts.
 */
export const resolveVerifiedNameAddress = async ({
    name,
    scope,
    signal,
}: ResolveVerifiedNameAddressParams): Promise<VerifiedNameResolution> => {
    let results: NameSearchResult[]
    try {
        results = await fetchNameSearch({ name, scope, signal })
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        return { status: 'unavailable' }
    }
    const match = results.at(0)
    if (!match) return { status: 'not-found' }
    const verdict = await verifyNameAddress({
        name: match.name,
        address: match.address,
        scope,
        signal,
    })
    return verdict === 'verified'
        ? { status: 'verified', address: match.address }
        : { status: verdict }
}
