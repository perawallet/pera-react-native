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
    i18nKey,
    type ChainScope,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { PeraService } from '@perawallet/wallet-core-config'
import { AppError, ErrorCategory, ErrorSeverity } from './base'

/**
 * Thrown when a `backend: 'pera'` request targets a scope with no Pera
 * deployment (betanet, a custom node), names a Pera service the scope's
 * configuration does not list, or names a deployment the build has no host for.
 *
 * Deliberately NOT retryable: unlike a `PeraNetworkError` outage, retrying can
 * never succeed, so React Query must fail fast rather than burn its budget.
 *
 * Raised by `createFetchClient` before ky is invoked at all, which is the
 * single place Pera requests are dispatched — so no socket is opened and no
 * consumer needs its own guard. Deliberately NOT raised from a ky
 * `beforeRequest` hook: ky builds the `Request` in its constructor, before
 * hooks run, so a spec-compliant `Request` would reject the prefix-less
 * relative URL with a bare `TypeError` first.
 */
export class PeraServiceUnavailableError extends AppError {
    /** Absent when the request named a deployment rather than a scope. */
    public readonly scope: ChainScope | undefined
    /** `chainId/networkId`, or `deployment/<mode>`. */
    public readonly targetKey: string
    public readonly service: PeraService | undefined

    constructor(
        target: ChainScope | { deployment: WalletMode },
        service?: PeraService,
    ) {
        const scope = 'deployment' in target ? undefined : target
        // Plain interpolation, not toScopeKey: building this error must never throw.
        const targetKey =
            scope === undefined
                ? `deployment/${(target as { deployment: WalletMode }).deployment}`
                : `${scope.chainId}/${scope.networkId}`
        super(
            `Pera services are not deployed for ${targetKey}` +
                (service === undefined ? '' : ` (service: ${service})`),
            {
                severity: ErrorSeverity.LOW,
                category: ErrorCategory.NETWORK,
                retryable: false,
                recoverable: false,
                messageKey: i18nKey('errors.pera_service.unavailable'),
                // Log context only — the copy deliberately says "this network"
                // rather than naming it, since the scope is an internal concept.
                params: { scope: targetKey, service },
            },
        )
        this.scope = scope
        this.targetKey = targetKey
        this.service = service
    }
}

/**
 * Type guard for {@link PeraServiceUnavailableError}.
 *
 * Deliberately NOT folded into `isTransientNetworkError`: a missing
 * deployment is permanent, not transient, and widening that predicate would
 * also tell React Query's retry logic the wrong thing. This is a separate,
 * sibling test — used at the crash-reporting sites (see the query/mutation
 * caches in `QueryProvider`) to skip reporting an expected condition as a
 * non-fatal.
 */
export const isPeraServiceUnavailableError = (
    error: unknown,
): error is PeraServiceUnavailableError =>
    error instanceof PeraServiceUnavailableError
