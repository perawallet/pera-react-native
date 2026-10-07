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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    CHAIN_IDS,
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import {
    RemoteConfigDefaults,
    RemoteConfigKeys,
} from '@perawallet/wallet-extension-platform'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRemoteConfigStore } from '../../store'
import { areConfigOverridesIgnored } from '../areConfigOverridesIgnored'
import {
    chainOverridesKey,
    parseChainOverrides,
    readCapabilityOverrides,
} from '../readCapabilityOverrides'

vi.mock('../areConfigOverridesIgnored', () => ({
    areConfigOverridesIgnored: vi.fn(() => false),
}))

const KEY = 'chain_algorand_overrides'

let remoteValues: Record<string, string> = {}

const useRemote = (values: Record<string, string>): void => {
    remoteValues = values
    vi.mocked(getProvider).mockReturnValue({
        remoteConfig: {
            getStringValue: (key: string, fallback = '') =>
                remoteValues[key] ?? fallback,
        },
    } as unknown as ReturnType<typeof getProvider>)
}

const setDeveloper = (value: string | null): void => {
    useRemoteConfigStore.getState().setConfigOverride(KEY, value)
}

describe('parseChainOverrides', () => {
    test('reads an empty string as no overrides', () => {
        expect(parseChainOverrides('', KEY)).toEqual({ capabilities: {} })
    })

    test('keeps the kill switch and the boolean capabilities', () => {
        expect(
            parseChainOverrides(
                '{"enabled":false,"capabilities":{"staking":false,"swap":true}}',
                KEY,
            ),
        ).toEqual({
            enabled: false,
            capabilities: { staking: false, swap: true },
        })
    })

    test('drops unknown capabilities and still honours the kill switch beside them', () => {
        expect(
            parseChainOverrides(
                '{"enabled":false,"capabilities":{"teleport":true,"staking":"no"}}',
                KEY,
            ),
        ).toEqual({ enabled: false, capabilities: {} })
    })

    test.each([
        ['invalid JSON', '{"enabled":'],
        ['a wrong-typed kill switch', '{"enabled":"false"}'],
        ['a non-object', '[]'],
    ])('ignores %s and warns once', (_, json) => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

        expect(parseChainOverrides(json, `${KEY}_${json}`)).toEqual({
            capabilities: {},
        })
        expect(parseChainOverrides(json, `${KEY}_${json}`)).toEqual({
            capabilities: {},
        })

        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockRestore()
    })
})

describe('readCapabilityOverrides', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        vi.mocked(areConfigOverridesIgnored).mockReturnValue(false)
        useRemote({})
    })

    test('gives no overrides while every blob is empty', () => {
        expect(readCapabilityOverrides()).toEqual({
            remote: { algorand: {}, ethereum: {} },
            developer: { algorand: {}, ethereum: {} },
            chainEnabled: {},
        })
    })

    test('puts the remote blob in the remote layer', () => {
        useRemote({ [KEY]: '{"capabilities":{"staking":false}}' })

        expect(readCapabilityOverrides().remote).toEqual({
            algorand: { staking: false },
            ethereum: {},
        })
    })

    test('puts the saved override in the developer layer', () => {
        setDeveloper('{"capabilities":{"staking":true}}')

        expect(readCapabilityOverrides().developer).toEqual({
            algorand: { staking: true },
            ethereum: {},
        })
    })

    test('drops the developer layer where overrides are ignored', () => {
        vi.mocked(areConfigOverridesIgnored).mockReturnValue(true)
        setDeveloper('{"enabled":false,"capabilities":{"staking":true}}')

        const overrides = readCapabilityOverrides()

        expect(overrides.developer).toEqual({ algorand: {}, ethereum: {} })
        expect(overrides.chainEnabled).toEqual({})
    })

    test("prefers the developer blob's kill switch over the remote one", () => {
        useRemote({ [KEY]: '{"enabled":false}' })
        setDeveloper('{"enabled":true}')

        expect(readCapabilityOverrides().chainEnabled).toEqual({
            algorand: true,
        })
    })

    test("falls back to the remote kill switch when the developer blob doesn't set one", () => {
        useRemote({ [KEY]: '{"enabled":false}' })
        setDeveloper('{"capabilities":{"swap":true}}')

        expect(readCapabilityOverrides().chainEnabled).toEqual({
            algorand: false,
        })
    })

    test('has a seeded remote key for every chain', () => {
        for (const chainId of CHAIN_IDS) {
            const key = chainOverridesKey(chainId)
            expect(RemoteConfigKeys).toHaveProperty(key, key)
            expect(RemoteConfigDefaults).toHaveProperty(key, '')
        }
    })

    describe('through the chain registry', () => {
        const build = Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, true]),
        ) as ChainCapabilities
        const registry = createChainRegistry()

        beforeEach(() => {
            registry.reset()
            registry.register(
                { id: 'algorand', networks: [] } as unknown as ChainDescriptor,
                build,
            )
            registry.setCapabilityOverrides(readCapabilityOverrides)
        })

        test('a remote false wins over build, a developer true over remote, and clearing it returns to remote', () => {
            useRemote({ [KEY]: '{"capabilities":{"staking":false}}' })
            expect(registry.capabilities('algorand').staking).toBe(false)

            setDeveloper('{"capabilities":{"staking":true}}')
            expect(registry.capabilities('algorand').staking).toBe(true)

            setDeveloper(null)
            expect(registry.capabilities('algorand').staking).toBe(false)
        })

        test('the remote kill switch turns every capability off and back on, leaving the chain registered', () => {
            useRemote({ [KEY]: '{"enabled":false}' })

            expect(
                Object.values(registry.capabilities('algorand')).every(
                    value => value === false,
                ),
            ).toBe(true)
            expect(registry.isSwitchedOff('algorand')).toBe(true)
            expect(registry.has('algorand')).toBe(true)

            useRemote({ [KEY]: '{"enabled":true}' })

            expect(registry.capabilities('algorand')).toEqual(build)
            expect(registry.isSwitchedOff('algorand')).toBe(false)
        })
    })
})
