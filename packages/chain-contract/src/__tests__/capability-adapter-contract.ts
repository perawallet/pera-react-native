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

import { describe, expect, it } from 'vitest'
import {
    CAPABILITY_ADAPTERS,
    type CapabilityAdapterName,
} from '../capabilities/adapters'
import type { ChainRegistry } from '../chain-registry'
import { CHAIN_CAPABILITIES } from '../models/capabilities'
import type { ChainId } from '../models/identity'

type Rule = 'default' | 'adapter'

type Violation = { rule: Rule; message: string }

/** Structural: satisfied by a `ChainAdapterRegistry` and by `LedgerAppDriverRegistry`, which predates it. */
export type CapabilityAdapterRegistries = Readonly<
    Record<CapabilityAdapterName, { has(chainId: ChainId): boolean }>
>

const collectViolations = (
    chains: ChainRegistry,
    registries: CapabilityAdapterRegistries,
): Violation[] => {
    const violations: Violation[] = []

    for (const descriptor of chains.list()) {
        const chainId = descriptor.id
        const capabilities = chains.capabilities(chainId)

        for (const capability of CHAIN_CAPABILITIES) {
            if (typeof capabilities[capability] !== 'boolean') {
                violations.push({
                    rule: 'default',
                    message: `capability "${capability}" has no boolean default on chain "${chainId}"`,
                })
                continue
            }

            if (
                !capabilities[capability] ||
                !(capability in CAPABILITY_ADAPTERS)
            ) {
                continue
            }

            const registryName =
                CAPABILITY_ADAPTERS[
                    capability as keyof typeof CAPABILITY_ADAPTERS
                ]
            if (!registries[registryName].has(chainId)) {
                violations.push({
                    rule: 'adapter',
                    message: `chain "${chainId}" enables "${capability}" but the "${registryName}" registry has no adapter for it`,
                })
            }
        }
    }

    return violations
}

export const capabilityAdapterContractViolations = (
    chains: ChainRegistry,
    registries: CapabilityAdapterRegistries,
): string[] => collectViolations(chains, registries).map(v => v.message)

const messagesFor = (
    chains: ChainRegistry,
    registries: CapabilityAdapterRegistries,
    rule: Rule,
): string[] =>
    collectViolations(chains, registries)
        .filter(v => v.rule === rule)
        .map(v => v.message)

/**
 * Every chain package runs this against its own registered chain(s) and the
 * feature registries those chains register adapters into.
 */
export const capabilityAdapterContractTests = (
    chains: ChainRegistry,
    registries: CapabilityAdapterRegistries,
): void => {
    describe('capability-to-adapter parity', () => {
        it('declares a boolean default for every capability on every registered chain', () => {
            expect(messagesFor(chains, registries, 'default')).toEqual([])
        })

        it('registers a feature adapter for every capability a chain enables', () => {
            expect(messagesFor(chains, registries, 'adapter')).toEqual([])
        })
    })
}
