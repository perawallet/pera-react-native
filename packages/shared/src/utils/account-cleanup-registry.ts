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

import { logger } from './logging'

export type AccountCleanupContext = {
    accountAddress: string
    /**
     * Active database handle, forwarded so every handler cleans up against the
     * same connection the removal flow used. Typed as `unknown` to keep this
     * package free of a `wallet-core-database` dependency (which would cycle);
     * handlers cast to their own `Database` type.
     */
    db?: unknown
}

export type AccountCleanupHandler = (
    context: AccountCleanupContext,
) => Promise<void>

const registry: AccountCleanupHandler[] = []

/**
 * Registers a handler to run when an account is removed. Called at module scope
 * by each domain package (e.g. transactions) that owns account-scoped rows
 * `packages/accounts` cannot delete directly without a package cycle.
 */
export const registerAccountCleanup = (
    handler: AccountCleanupHandler,
): void => {
    registry.push(handler)
}

/**
 * Runs every registered cleanup handler for the removed account. Best-effort:
 * a handler that rejects is logged and skipped so one domain's failure never
 * blocks another's cleanup.
 */
export const runAccountCleanups = async (
    context: AccountCleanupContext,
): Promise<void> => {
    await Promise.all(
        registry.map(async handler => {
            try {
                await handler(context)
            } catch (error) {
                logger.error(
                    error instanceof Error
                        ? error
                        : new Error('Account cleanup handler failed'),
                )
            }
        }),
    )
}

/**
 * Returns a read-only view of all registered cleanup handlers.
 */
export const getAccountCleanupRegistry =
    (): ReadonlyArray<AccountCleanupHandler> => registry

/**
 * Resets the registry. For testing only.
 */
export const resetAccountCleanupRegistry = (): void => {
    registry.length = 0
}
