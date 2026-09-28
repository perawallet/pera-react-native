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

import { describe, it, expect } from 'vitest'
import {
    AmbiguousLedgerAppDriverError,
    createLedgerAppDriverRegistry,
    DuplicateLedgerAppDriverError,
    LedgerAppDriverNotRegisteredError,
    type LedgerAppDriver,
} from '../app-driver'

const makeDriver = (chainId: string): LedgerAppDriver => ({
    chainId,
    open: () => {
        throw new Error('not openable in tests')
    },
})

describe('createLedgerAppDriverRegistry', () => {
    it('resolves a registered driver by chain', () => {
        const registry = createLedgerAppDriverRegistry()
        const driver = makeDriver('algorand')

        registry.register(driver)

        expect(registry.has('algorand')).toBe(true)
        expect(registry.resolve('algorand')).toBe(driver)
    })

    it('resolves the only registered driver when no chain is given', () => {
        const registry = createLedgerAppDriverRegistry()
        const driver = makeDriver('algorand')

        registry.register(driver)

        expect(registry.resolve()).toBe(driver)
    })

    it('throws when no driver is registered', () => {
        const registry = createLedgerAppDriverRegistry()

        expect(() => registry.resolve()).toThrow(
            LedgerAppDriverNotRegisteredError,
        )
        expect(() => registry.resolve('algorand')).toThrow(
            LedgerAppDriverNotRegisteredError,
        )
    })

    it('throws when the requested chain has no driver', () => {
        const registry = createLedgerAppDriverRegistry()
        registry.register(makeDriver('algorand'))

        expect(() => registry.resolve('ethereum')).toThrow(
            'No Ledger app driver is registered for chain "ethereum"',
        )
    })

    it('refuses to guess between several drivers', () => {
        const registry = createLedgerAppDriverRegistry()
        const algorand = makeDriver('algorand')
        registry.register(algorand)
        registry.register(makeDriver('ethereum'))

        expect(() => registry.resolve()).toThrow(AmbiguousLedgerAppDriverError)
        expect(registry.resolve('algorand')).toBe(algorand)
    })

    it('ignores the same instance registered twice', () => {
        const registry = createLedgerAppDriverRegistry()
        const driver = makeDriver('algorand')

        registry.register(driver)

        expect(() => registry.register(driver)).not.toThrow()
        expect(registry.resolve()).toBe(driver)
    })

    it('rejects a different driver for a registered chain', () => {
        const registry = createLedgerAppDriverRegistry()
        registry.register(makeDriver('algorand'))

        expect(() => registry.register(makeDriver('algorand'))).toThrow(
            DuplicateLedgerAppDriverError,
        )
    })

    it('drops every registration on reset', () => {
        const registry = createLedgerAppDriverRegistry()
        registry.register(makeDriver('algorand'))

        registry.reset()

        expect(registry.has('algorand')).toBe(false)
    })
})
