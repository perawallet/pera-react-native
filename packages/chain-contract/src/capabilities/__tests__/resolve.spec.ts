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
import type { ChainId, ChainMode } from '../../models/identity'
import {
    isRestrictedIn,
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
    ethereum: allCapabilities(false),
})

type Row = {
    name: string
    layers: CapabilityLayers
    capability: ChainCapability
    expected: {
        value: boolean
        source: 'build' | 'remote' | 'chainMode' | 'developer'
    }
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

describe('isRestrictedIn', () => {
    const restrictions = { swap: ['developer', 'developer-override'] } as const

    it.each([
        ['developer', 'swap', true],
        ['developer-override', 'swap', true],
        ['live', 'swap', false],
        ['developer', 'card', false],
    ] as const)('%s for %s: %s', (mode, key, expected) => {
        expect(isRestrictedIn(restrictions, key, mode)).toBe(expected)
    })

    it('is only restricted in the listed modes', () => {
        expect(
            isRestrictedIn(
                { swap: ['developer-override'] },
                'swap',
                'developer',
            ),
        ).toBe(false)
    })

    it('is never restricted without a map', () => {
        expect(isRestrictedIn(undefined, 'swap', 'developer')).toBe(false)
    })
})

describe('mode restrictions', () => {
    const MODES: ChainMode[] = ['live', 'developer', 'developer-override']
    const layersFor = (
        mode: ChainMode,
        {
            buildValue,
            remote,
            developer,
            restricted,
        }: {
            buildValue: boolean
            remote?: boolean
            developer?: boolean
            restricted: boolean
        },
    ): CapabilityLayers => ({
        build: build(buildValue),
        remote:
            remote === undefined ? undefined : { algorand: { swap: remote } },
        developer:
            developer === undefined
                ? undefined
                : { algorand: { swap: developer } },
        restrictions: restricted
            ? { algorand: { swap: ['developer', 'developer-override'] } }
            : undefined,
        chainMode: { algorand: mode },
    })

    it.each(MODES.filter(mode => mode !== 'live'))(
        'switches off a restricted capability in %s even when build and remote are true',
        mode => {
            expect(
                resolveCapabilityWithSource(
                    'algorand',
                    'swap',
                    layersFor(mode, {
                        buildValue: true,
                        remote: true,
                        restricted: true,
                    }),
                ),
            ).toEqual({ value: false, source: 'chainMode' })
        },
    )

    it.each([true, false])(
        'lets a Feature Flags value of %s win over the restriction',
        developer => {
            expect(
                resolveCapabilityWithSource(
                    'algorand',
                    'swap',
                    layersFor('developer', {
                        buildValue: true,
                        developer,
                        restricted: true,
                    }),
                ),
            ).toEqual({ value: developer, source: 'developer' })
        },
    )

    it('leaves a restricted capability alone in live', () => {
        expect(
            resolveCapabilityWithSource(
                'algorand',
                'swap',
                layersFor('live', {
                    buildValue: false,
                    remote: true,
                    restricted: true,
                }),
            ),
        ).toEqual({ value: true, source: 'remote' })
    })

    it.each(MODES)(
        'resolves an unrestricted capability as before in %s',
        mode => {
            expect(
                resolveCapabilityWithSource(
                    'algorand',
                    'swap',
                    layersFor(mode, {
                        buildValue: false,
                        remote: true,
                        restricted: false,
                    }),
                ),
            ).toEqual({ value: true, source: 'remote' })
        },
    )

    it('reads a chain with no mode as live', () => {
        expect(
            resolveCapabilityWithSource('algorand', 'swap', {
                build: build(true),
                restrictions: { algorand: { swap: ['developer'] } },
            }),
        ).toEqual({ value: true, source: 'build' })
    })
})
