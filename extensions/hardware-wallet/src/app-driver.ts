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

import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import type { HardwareWalletTransport } from './types'

/**
 * The connected `@ledgerhq/hw-transport` instance a transport extension opens.
 * Typed only as far as this package reads it, so it takes no `@ledgerhq`
 * dependency; a driver hands the same object to its app library, which needs
 * the full class, so pass the real instance, never a stand-in shaped like this.
 */
export type LedgerAppTransport = {
    close: () => Promise<void>
    /**
     * `@ledgerhq/hw-transport`'s emitter. Optional because a transport may not
     * emit anything (the web ones, and test doubles); the driver then omits
     * `onDisconnect` so callers can tell detection is unavailable.
     */
    on?: (event: 'disconnect', listener: () => void) => void
    off?: (event: 'disconnect', listener: () => void) => void
}

/** Maps a transport's own error shapes, which APDU exchanges surface too. */
export type LedgerAppErrorClassifier = (error: unknown) => AppError

/**
 * Speaks one chain's Ledger app over a device link, so the transport
 * extensions stay chain-neutral. Registered by the chain package.
 */
export interface LedgerAppDriver {
    /** A chain-contract `ChainId`; extensions may not depend on chain-contract. */
    chainId: string
    /** The device app the user opens for this chain, as Ledger Live lists it. */
    appName: string
    open(
        transport: LedgerAppTransport,
        classifyError?: LedgerAppErrorClassifier,
    ): HardwareWalletTransport
}

// oxlint-disable-next-line pera/typed-domain-errors -- classifyLedgerError must make this a retryable LedgerConnectionError; an AppError passes through
export class LedgerAppDriverNotRegisteredError extends Error {
    readonly chainId: string

    constructor(chainId: string) {
        super(`No Ledger app driver is registered for chain "${chainId}"`)
        this.name = 'LedgerAppDriverNotRegisteredError'
        this.chainId = chainId
    }
}

export class DuplicateLedgerAppDriverError extends AppError {
    readonly chainId: string

    constructor(chainId: string) {
        super(
            `A different Ledger app driver is already registered for chain "${chainId}"`,
            { category: ErrorCategory.BLOCKCHAIN },
        )
        this.name = 'DuplicateLedgerAppDriverError'
        this.chainId = chainId
    }
}

export interface LedgerAppDriverRegistry {
    register(driver: LedgerAppDriver): void
    /** @throws LedgerAppDriverNotRegisteredError */
    resolve(chainId: string): LedgerAppDriver
    has(chainId: string): boolean
    /** Test-only: drops every registration. */
    reset(): void
}

/**
 * Same rules as chain-contract's `createChainAdapterRegistry`, which this
 * tier may not import: re-registering the same instance is a no-op, so a
 * repeated bootstrap stays safe, and a different one throws.
 */
export const createLedgerAppDriverRegistry = (): LedgerAppDriverRegistry => {
    const drivers = new Map<string, LedgerAppDriver>()

    return {
        register: driver => {
            const existing = drivers.get(driver.chainId)
            if (existing === driver) {
                return
            }
            if (existing) {
                throw new DuplicateLedgerAppDriverError(driver.chainId)
            }
            drivers.set(driver.chainId, driver)
        },
        resolve: chainId => {
            const driver = drivers.get(chainId)
            if (!driver) {
                throw new LedgerAppDriverNotRegisteredError(chainId)
            }
            return driver
        },
        has: chainId => drivers.has(chainId),
        reset: () => {
            drivers.clear()
        },
    }
}

// Module-level like the chain adapter registries: the chain package registers
// into it at bootstrap and the transports look it up when they connect.
export const ledgerAppDriverRegistry = createLedgerAppDriverRegistry()
