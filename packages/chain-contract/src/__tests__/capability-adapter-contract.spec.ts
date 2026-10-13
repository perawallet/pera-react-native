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
import { createChainRegistry } from '../chain-registry'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
} from '../models/capabilities'
import type { ChainDescriptor } from '../models/descriptor'
import {
    capabilityAdapterContractViolations,
    type CapabilityAdapterRegistries,
} from './capability-adapter-contract'

const descriptor = (id: string): ChainDescriptor =>
    ({ id, networks: [] }) as unknown as ChainDescriptor

const allTrue = (): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, true]),
    ) as ChainCapabilities

const allFalse = (): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, false]),
    ) as ChainCapabilities

const fakeRegistry = (registered: boolean) => ({
    has: () => registered,
})

const registries = (registered: boolean): CapabilityAdapterRegistries => ({
    'send flow': fakeRegistry(registered),
    planner: fakeRegistry(registered),
    reviewer: fakeRegistry(registered),
    'local-key signer': fakeRegistry(registered),
    broadcaster: fakeRegistry(registered),
    addressCodec: fakeRegistry(registered),
    accounts: fakeRegistry(registered),
    'transaction history': fakeRegistry(registered),
    assets: fakeRegistry(registered),
    'message signer': fakeRegistry(registered),
    multisig: fakeRegistry(registered),
    backup: fakeRegistry(registered),
    swap: fakeRegistry(registered),
    'name service': fakeRegistry(registered),
    card: fakeRegistry(registered),
    ramp: fakeRegistry(registered),
    'dapp-request': fakeRegistry(registered),
    'ledger app driver': fakeRegistry(registered),
})

describe('capabilityAdapterContractViolations', () => {
    it('is silent when every capability has a default and every enabled one has its adapter', () => {
        const chains = createChainRegistry()
        chains.register(descriptor('algorand'), allTrue())

        expect(
            capabilityAdapterContractViolations(chains, registries(true)),
        ).toEqual([])
    })

    it('names the missing key when a capability default is omitted', () => {
        const chains = createChainRegistry()
        const { assets: _assets, ...incomplete } = allTrue()
        chains.register(
            descriptor('algorand'),
            incomplete as unknown as ChainCapabilities,
        )

        expect(
            capabilityAdapterContractViolations(chains, registries(true)),
        ).toEqual([
            'capability "assets" has no boolean default on chain "algorand"',
        ])
    })

    it('names every registry an enabled capability is missing', () => {
        const chains = createChainRegistry()
        chains.register(descriptor('algorand'), {
            ...allFalse(),
            send: true,
        })

        expect(
            capabilityAdapterContractViolations(chains, registries(false)),
        ).toEqual([
            'chain "algorand" enables "send" but the "send flow" registry has no adapter for it',
            'chain "algorand" enables "send" but the "planner" registry has no adapter for it',
            'chain "algorand" enables "send" but the "reviewer" registry has no adapter for it',
            'chain "algorand" enables "send" but the "local-key signer" registry has no adapter for it',
            'chain "algorand" enables "send" but the "broadcaster" registry has no adapter for it',
        ])
    })

    it('reports only the registry that is missing', () => {
        const chains = createChainRegistry()
        chains.register(descriptor('algorand'), allTrue())

        expect(
            capabilityAdapterContractViolations(chains, {
                ...registries(true),
                broadcaster: fakeRegistry(false),
            }),
        ).toEqual([
            'chain "algorand" enables "send" but the "broadcaster" registry has no adapter for it',
        ])
    })

    it('does not require an adapter for a capability that is off', () => {
        const chains = createChainRegistry()
        chains.register(descriptor('algorand'), { ...allTrue(), swap: false })

        const violations = capabilityAdapterContractViolations(
            chains,
            registries(false),
        )

        expect(violations.some(message => message.includes('"swap"'))).toBe(
            false,
        )
    })
})
