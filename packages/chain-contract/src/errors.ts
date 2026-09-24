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

import type { ChainScope } from './models/identity'

/**
 * A chain's selected network changed between capturing a scope and using it.
 * Thrown so the caller aborts instead of acting on the wrong network.
 */
export class ScopeChangedError extends Error {
    readonly expected: ChainScope
    readonly actual: ChainScope

    constructor(expected: ChainScope, actual: ChainScope) {
        // Plain interpolation, not toScopeKey: building this error must never throw.
        super(
            `Scope changed: expected ${expected.chainId}/${expected.networkId} but the active scope is ${actual.chainId}/${actual.networkId}`,
        )
        this.name = 'ScopeChangedError'
        this.expected = expected
        this.actual = actual
    }
}

export class InvalidScopeKeyError extends Error {
    readonly key: string

    constructor(key: string) {
        super(`Invalid chain scope key: "${key}"`)
        this.name = 'InvalidScopeKeyError'
        this.key = key
    }
}
