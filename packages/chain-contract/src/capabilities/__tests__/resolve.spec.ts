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
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainCapability,
} from '../../models/capabilities'
import type { ChainId } from '../../models/identity'
import {
    resolveCapability,
    resolveCapabilityWithSource,
    type CapabilityLayers,
} from '../resolve'

// ChainId has one member today; a second chain is simulated with a cast.
const OTHER = 'other' as ChainId

const allCapabilities = (value: boolean): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, value]),
    ) as ChainCapabilities

const build = (swap: boolean): CapabilityLayers['build'] => ({
    algorand: { ...allCapabilities(false), swap },
})

type Row = {
    name: string
    layers: CapabilityLayers
    capability: ChainCapability
    expected: { value: boolean; source: 'build' | 'remote' | 'developer' }
}

// Mirrors readRemoteConfigWithOverrides: a typed override wins, then the
// fetched value, and an override of the wrong type falls through rather than coerce.
const rows: Row[] = [
    {
        name: 'a developer override beats remote and build',
        layers: {
            build: build(false),
            remote: { algorand: { swap: false } },
            developer: { algorand: { swap: true } },
        },
        capability: 'swap',
        expected: { value: true, source: 'developer' },
    },
    {
        name: 'a mistyped developer override falls through to remote',
        layers: {
            build: build(false),
            remote: { algorand: { swap: true } },
            developer: { algorand: { swap: 'yes' } },
        },
        capability: 'swap',
        expected: { value: true, source: 'remote' },
    },
    {
        name: 'a fetched remote value beats build',
        layers: {
            build: build(true),
            remote: { algorand: { swap: false } },
        },
        capability: 'swap',
        expected: { value: false, source: 'remote' },
    },
    {
        name: 'a capability remote did not fetch reads build',
        layers: {
            build: build(true),
            remote: { algorand: {} },
            developer: {},
        },
        capability: 'swap',
        expected: { value: true, source: 'build' },
    },
    {
        name: 'a mistyped remote value falls through to build',
        layers: {
            build: build(true),
            remote: { algorand: { swap: 'false' } },
        },
        capability: 'swap',
        expected: { value: true, source: 'build' },
    },
    {
        name: 'an override for another capability does not apply',
        layers: {
            build: build(true),
            remote: { algorand: { card: false } },
            developer: { algorand: { staking: false } },
        },
        capability: 'swap',
        expected: { value: true, source: 'build' },
    },
    {
        name: 'an override for another chain does not apply',
        layers: {
            build: build(true),
            remote: { [OTHER]: { swap: false } },
            developer: { [OTHER]: { swap: false } },
        },
        capability: 'swap',
        expected: { value: true, source: 'build' },
    },
    {
        name: 'no remote and no developer layer reads build',
        layers: { build: build(false) },
        capability: 'swap',
        expected: { value: false, source: 'build' },
    },
]

describe('resolveCapabilityWithSource', () => {
    it.each(rows)('$name', ({ layers, capability, expected }) => {
        expect(
            resolveCapabilityWithSource('algorand', capability, layers),
        ).toEqual(expected)
    })
})

describe('resolveCapability', () => {
    it.each(rows)(
        'matches the resolved value: $name',
        ({ layers, capability }) => {
            expect(resolveCapability('algorand', capability, layers)).toBe(
                resolveCapabilityWithSource('algorand', capability, layers)
                    .value,
            )
        },
    )
})
