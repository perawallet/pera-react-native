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

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    resolveCapability,
    type CapabilityLayers,
} from '@perawallet/wallet-core-chain-contract'

const loadWith = async (appEnvironment: string, chainId = 'ethereum') => {
    vi.resetModules()
    vi.doMock('@perawallet/wallet-core-config', async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-config')
            >()
        return { ...actual, config: { ...actual.config, appEnvironment } }
    })
    const [
        { evmChainOf },
        { evmSupportedCapabilitiesOf, evmCapabilityDefaultsOf },
    ] = await Promise.all([
        import('../chains/table'),
        import('../capability-defaults'),
    ])
    const { row } = evmChainOf(chainId)
    return {
        row,
        supported: evmSupportedCapabilitiesOf(row),
        defaults: evmCapabilityDefaultsOf(row),
    }
}

const ENVIRONMENTS = ['development', 'staging', 'production']

const expectRemoteCanSwitchSwapOff = async (chainId: string) => {
    const { defaults } = await loadWith('production', chainId)
    const build = { [chainId]: defaults } as CapabilityLayers['build']

    expect(resolveCapability(chainId, 'swap', { build })).toBe(true)
    expect(
        resolveCapability(chainId, 'swap', {
            build,
            remote: { [chainId]: { swap: false } },
        }),
    ).toBe(false)
}

describe('the onramp capability', () => {
    afterEach(() => {
        vi.doUnmock('@perawallet/wallet-core-config')
        vi.resetModules()
    })

    it.each(['development', 'staging'])('defaults on in %s', async env => {
        const { row } = await loadWith(env)

        expect(row.capabilities?.onramp).toBe(true)
    })

    it('defaults off in production, where remote config can still switch it', async () => {
        const { row, supported } = await loadWith('production')

        expect(row.capabilities?.onramp).toBe(false)
        expect(supported).toContain('onramp')
    })
})

describe('the swap capability', () => {
    afterEach(() => {
        vi.doUnmock('@perawallet/wallet-core-config')
        vi.resetModules()
    })

    it.each(ENVIRONMENTS)('defaults on in %s', async env => {
        const { row } = await loadWith(env)

        expect(row.capabilities?.swap).toBe(true)
    })

    it('lets remote config switch it off in production', async () => {
        await expectRemoteCanSwitchSwapOff('ethereum')
    })
})

describe.each([
    ['base', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
    ['arbitrum', '0xaf88d065e77c8cC2239327C5EDB3A432268e5831'],
])('the %s swap defaults', (chainId, usdc) => {
    afterEach(() => {
        vi.doUnmock('@perawallet/wallet-core-config')
        vi.resetModules()
    })

    it.each(ENVIRONMENTS)('turn swap on in %s', async env => {
        const { row } = await loadWith(env, chainId)

        expect(row.capabilities?.swap).toBe(true)
    })

    it('let remote config switch swap off in production', async () => {
        await expectRemoteCanSwitchSwapOff(chainId)
    })

    it('receive native USDC by default', async () => {
        const { row } = await loadWith('development', chainId)

        expect(row.defaultSwapReceiveAssetId).toBe(usdc)
    })
})

describe('the optimism capabilities', () => {
    afterEach(() => {
        vi.doUnmock('@perawallet/wallet-core-config')
        vi.resetModules()
    })

    it.each(['development', 'staging', 'production'])(
        'leave swap and onramp off in %s, where remote config can still switch them',
        async env => {
            const { row, supported, defaults } = await loadWith(env, 'optimism')

            expect(row.capabilities).toBeUndefined()
            expect(defaults.swap).toBe(false)
            expect(defaults.onramp).toBe(false)
            expect(defaults.discover).toBe(true)
            expect(supported).toContain('swap')
            expect(supported).toContain('onramp')
        },
    )
})
