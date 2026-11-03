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
    type ChainCapability,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useRemoteConfigStore } from '../../store'
import { areConfigOverridesIgnored } from '../areConfigOverridesIgnored'
import {
    parseChainOverrides,
    readCapabilityOverrides,
} from '../readCapabilityOverrides'

vi.mock('../areConfigOverridesIgnored', () => ({
    areConfigOverridesIgnored: vi.fn(() => false),
}))

const KEY = 'chain_algorand_overrides'
const ETHEREUM_KEY = 'chain_ethereum_overrides'
const UNSUPPORTED_WARNING =
    'Ignoring overrides for capabilities the chain does not support'

const registry = createChainRegistry()

const supportsAll = (): boolean => true

let remoteValues: Record<string, string> = {}

const useRemote = (values: Record<string, string>): void => {
    remoteValues = values
    vi.mocked(getProvider).mockReturnValue({
        remoteConfig: {
            getStringValue: (key: string, fallback = '') =>
                remoteValues[key] ?? fallback,
        },
        chains: registry,
    } as unknown as ReturnType<typeof getProvider>)
}

const setDeveloper = (value: string | null): void => {
    useRemoteConfigStore.getState().setConfigOverride(KEY, value)
}

describe('parseChainOverrides', () => {
    test('reads an empty string as no overrides', () => {
        expect(parseChainOverrides('', KEY, supportsAll)).toEqual({
            capabilities: {},
        })
    })

    test('keeps the kill switch and the boolean capabilities', () => {
        expect(
            parseChainOverrides(
                '{"enabled":false,"capabilities":{"staking":false,"swap":true}}',
                KEY,
                supportsAll,
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
                supportsAll,
            ),
        ).toEqual({ enabled: false, capabilities: {} })
    })

    test('ignores the retired arc0027 capability', () => {
        expect(
            parseChainOverrides(
                '{"capabilities":{"arc0027":false}}',
                KEY,
                supportsAll,
            ),
        ).toEqual({ capabilities: {} })
    })

    test.each([
        ['invalid JSON', '{"enabled":'],
        ['a wrong-typed kill switch', '{"enabled":"false"}'],
        ['a non-object', '[]'],
    ])('ignores %s and warns once', (_, json) => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

        const remoteConfigKey = `${KEY}_${json}`

        expect(parseChainOverrides(json, remoteConfigKey, supportsAll)).toEqual(
            {
                capabilities: {},
            },
        )
        expect(parseChainOverrides(json, remoteConfigKey, supportsAll)).toEqual(
            {
                capabilities: {},
            },
        )

        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            'Ignoring malformed chain overrides',
            expect.objectContaining({ remoteConfigKey }),
        )
        warn.mockRestore()
    })

    test.each(['assetInbox', 'rekey', 'staking'] as const)(
        'refuses switching on %s where the chain does not support it, and warns once',
        capability => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            const remoteConfigKey = `${ETHEREUM_KEY}_${capability}`
            const json = `{"capabilities":{"${capability}":true,"send":true}}`
            const supports = (candidate: ChainCapability): boolean =>
                candidate !== capability

            expect(
                parseChainOverrides(json, remoteConfigKey, supports),
            ).toEqual({ capabilities: { send: true } })
            expect(
                parseChainOverrides(json, remoteConfigKey, supports),
            ).toEqual({ capabilities: { send: true } })

            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith(UNSUPPORTED_WARNING, {
                remoteConfigKey,
                capabilities: [capability],
            })
            warn.mockRestore()
        },
    )

    test('keeps a false for a capability the chain does not support', () => {
        expect(
            parseChainOverrides(
                '{"capabilities":{"assetInbox":false}}',
                KEY,
                () => false,
            ),
        ).toEqual({ capabilities: { assetInbox: false } })
    })
})

describe('readCapabilityOverrides', () => {
    beforeEach(() => {
        registry.reset()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(areConfigOverridesIgnored).mockReturnValue(false)
        useRemote({})
    })

    // Every chain is read, so every chain has a layer entry.
    const emptyLayer = (): Record<string, object> =>
        Object.fromEntries(CHAIN_IDS.map(chainId => [chainId, {}]))

    test('gives no overrides while every blob is empty', () => {
        expect(readCapabilityOverrides()).toEqual({
            remote: emptyLayer(),
            developer: emptyLayer(),
            chainEnabled: {},
        })
    })

    test('puts the remote blob in the remote layer', () => {
        useRemote({ [KEY]: '{"capabilities":{"staking":false}}' })

        expect(readCapabilityOverrides().remote).toEqual({
            ...emptyLayer(),
            algorand: { staking: false },
        })
    })

    test('puts the saved override in the developer layer', () => {
        setDeveloper('{"capabilities":{"staking":true}}')

        expect(readCapabilityOverrides().developer).toEqual({
            ...emptyLayer(),
            algorand: { staking: true },
        })
    })

    test('drops the developer layer where overrides are ignored', () => {
        vi.mocked(areConfigOverridesIgnored).mockReturnValue(true)
        setDeveloper('{"enabled":false,"capabilities":{"staking":true}}')

        const overrides = readCapabilityOverrides()

        expect(overrides.developer).toEqual(emptyLayer())
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

    describe('through the chain registry', () => {
        const build = Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, true]),
        ) as ChainCapabilities
        const allOff = Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, false]),
        ) as ChainCapabilities

        beforeEach(() => {
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

        test('the remote kill switch turns off the Pera backend alone, leaving capabilities and the chain registered', () => {
            useRemote({ [KEY]: '{"enabled":false}' })

            expect(registry.capabilities('algorand')).toEqual(build)
            expect(registry.isSwitchedOff('algorand')).toBe(true)
            expect(registry.has('algorand')).toBe(true)

            useRemote({ [KEY]: '{"enabled":true}' })

            expect(registry.capabilities('algorand')).toEqual(build)
            expect(registry.isSwitchedOff('algorand')).toBe(false)
        })

        describe('on a chain that supports only send', () => {
            const ALGORAND_ONLY =
                '{"capabilities":{"assetInbox":true,"rekey":true,"staking":true}}'

            beforeEach(() => {
                registry.register(
                    {
                        id: 'ethereum',
                        networks: [],
                    } as unknown as ChainDescriptor,
                    { ...allOff, send: true },
                    undefined,
                    ['send'],
                )
            })

            test('a remote true for assetInbox, rekey or staking leaves them off and warns once', () => {
                const warn = vi
                    .spyOn(logger, 'warn')
                    .mockImplementation(() => {})
                useRemote({ [ETHEREUM_KEY]: ALGORAND_ONLY })

                const first = registry.capabilities('ethereum')
                const second = registry.capabilities('ethereum')

                for (const capabilities of [first, second]) {
                    expect(capabilities.assetInbox).toBe(false)
                    expect(capabilities.rekey).toBe(false)
                    expect(capabilities.staking).toBe(false)
                }
                expect(warn).toHaveBeenCalledTimes(1)
                expect(warn).toHaveBeenCalledWith(UNSUPPORTED_WARNING, {
                    remoteConfigKey: ETHEREUM_KEY,
                    capabilities: ['rekey', 'staking', 'assetInbox'],
                })
                warn.mockRestore()
            })

            test('a developer true is refused the same way', () => {
                const warn = vi
                    .spyOn(logger, 'warn')
                    .mockImplementation(() => {})
                useRemoteConfigStore
                    .getState()
                    .setConfigOverride(
                        ETHEREUM_KEY,
                        '{"capabilities":{"staking":true}}',
                    )

                expect(readCapabilityOverrides().developer?.ethereum).toEqual(
                    {},
                )
                expect(registry.capabilities('ethereum').staking).toBe(false)
                expect(warn).toHaveBeenCalledTimes(1)
                warn.mockRestore()
            })

            test('a remote false still switches a supported capability off', () => {
                useRemote({ [ETHEREUM_KEY]: '{"capabilities":{"send":false}}' })

                expect(registry.capabilities('ethereum').send).toBe(false)
            })
        })

        test('lets a chain registered without a list switch anything on', () => {
            registry.reset()
            registry.register(
                { id: 'algorand', networks: [] } as unknown as ChainDescriptor,
                allOff,
            )
            registry.setCapabilityOverrides(readCapabilityOverrides)
            useRemote({
                [KEY]: '{"capabilities":{"assetInbox":true,"rekey":true,"staking":true}}',
            })

            const capabilities = registry.capabilities('algorand')

            expect(capabilities.assetInbox).toBe(true)
            expect(capabilities.rekey).toBe(true)
            expect(capabilities.staking).toBe(true)
        })
    })
})
