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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    Eip1193ProviderError,
    createEip1193Provider,
    type PeraEip1193Provider,
} from '../eip1193-main'
import {
    PERA_EIP6963_ICON,
    PERA_EIP6963_NAME,
    PERA_EIP6963_RDNS,
} from '@perawallet/wallet-core-browser-runtime'

type Announced = {
    info: { uuid: string; name: string; icon: string; rdns: string }
    provider: unknown
}

const loadInstaller = async () => {
    vi.resetModules()
    return (await import('../eip1193-main')).installEip1193Provider
}

// Earlier tests' installs stay subscribed to the request event, so only the
// announcements carrying this install's detail count.
const collectAnnouncements = (): Announced[] => {
    const seen: Announced[] = []
    window.addEventListener('eip6963:announceProvider', e =>
        seen.push((e as CustomEvent<Announced>).detail),
    )
    return seen
}
const ownOf = (seen: Announced[]): Announced[] =>
    seen.filter(detail => detail === seen[0])

const clearEthereum = (): void => {
    delete (window as { ethereum?: unknown }).ethereum
}

describe('installEip1193Provider', () => {
    const provider = createEip1193Provider(async () => null).provider

    beforeEach(clearEthereum)
    afterEach(clearEthereum)

    it('claims window.ethereum when no other wallet has', async () => {
        const install = await loadInstaller()
        install(provider)
        expect((window as { ethereum?: unknown }).ethereum).toBe(provider)
    })

    it('leaves another wallet’s window.ethereum in place', async () => {
        const other = { isMetaMask: true }
        Object.defineProperty(window, 'ethereum', {
            value: other,
            writable: true,
            configurable: true,
        })
        const install = await loadInstaller()
        install(provider)
        expect((window as { ethereum?: unknown }).ethereum).toBe(other)
    })

    it('stays replaceable by a wallet that injects later, by assignment or define', async () => {
        const install = await loadInstaller()
        install(provider)
        const assigned = { isMetaMask: true }
        ;(window as { ethereum?: unknown }).ethereum = assigned
        expect((window as { ethereum?: unknown }).ethereum).toBe(assigned)
        const defined = { isRabby: true }
        Object.defineProperty(window, 'ethereum', {
            value: defined,
            configurable: true,
            writable: false,
        })
        expect((window as { ethereum?: unknown }).ethereum).toBe(defined)
    })

    it('announces through EIP-6963 at install and on every request, whoever holds window.ethereum', async () => {
        Object.defineProperty(window, 'ethereum', {
            value: { isMetaMask: true },
            writable: true,
            configurable: true,
        })
        const seen = collectAnnouncements()
        const install = await loadInstaller()
        install(provider)
        window.dispatchEvent(new Event('eip6963:requestProvider'))

        const own = ownOf(seen)
        expect(own).toHaveLength(2)
        const [first, second] = own
        expect(first.provider).toBe(provider)
        expect(first.info).toEqual({
            uuid: expect.stringMatching(/^[0-9a-f-]{36}$/),
            name: PERA_EIP6963_NAME,
            icon: PERA_EIP6963_ICON,
            rdns: PERA_EIP6963_RDNS,
        })
        expect(PERA_EIP6963_ICON.startsWith('data:image/svg+xml;base64,')).toBe(
            true,
        )
        expect(second).toBe(first)
        expect(Object.isFrozen(first)).toBe(true)
        expect(Object.isFrozen(first.info)).toBe(true)
    })

    it('installs once however often it is called', async () => {
        const seen = collectAnnouncements()
        const install = await loadInstaller()
        install(provider)
        install(provider)
        window.dispatchEvent(new Event('eip6963:requestProvider'))
        expect(ownOf(seen)).toHaveLength(2)
    })
})

describe('createEip1193Provider', () => {
    const setup = (
        answer: (method: string, params?: unknown) => Promise<unknown>,
    ) => {
        const send = vi.fn(answer)
        const { provider, handleNotification } = createEip1193Provider(send)
        const events: Array<[string, unknown]> = []
        const on = (event: Parameters<PeraEip1193Provider['on']>[0]) =>
            provider.on(event, payload => events.push([event, payload]))
        on('connect')
        on('chainChanged')
        on('accountsChanged')
        return { provider, handleNotification, send, events }
    }

    it('is marked as Pera and takes the flags dApps set on it at startup', () => {
        const { provider } = setup(async () => null)
        expect(provider.isPera).toBe(true)
        expect(() => {
            ;(
                provider as unknown as { autoRefreshOnNetworkChange: boolean }
            ).autoRefreshOnNetworkChange = false
        }).not.toThrow()
    })

    it('forwards the method and params and resolves with the wallet’s answer', async () => {
        const { provider, send } = setup(async () => '0x1')
        await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe(
            '0x1',
        )
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
        })
        expect(send).toHaveBeenLastCalledWith('wallet_switchEthereumChain', [
            { chainId: '0x2105' },
        ])
    })

    it('rejects malformed request arguments without sending', async () => {
        const { provider, send } = setup(async () => null)
        await expect(
            provider.request(undefined as never),
        ).rejects.toMatchObject({ code: -32_602 })
        await expect(
            provider.request({ method: 7 } as never),
        ).rejects.toBeInstanceOf(Eip1193ProviderError)
        expect(send).not.toHaveBeenCalled()
    })

    it('shares one in-flight eth_requestAccounts', async () => {
        let resolve: (value: unknown) => void = () => {}
        const { provider, send } = setup(
            () => new Promise(done => (resolve = done)),
        )
        const first = provider.request({ method: 'eth_requestAccounts' })
        const second = provider.request({ method: 'eth_requestAccounts' })
        expect(send).toHaveBeenCalledTimes(1)
        resolve(['0xab'])
        await expect(first).resolves.toEqual(['0xab'])
        await expect(second).resolves.toEqual(['0xab'])
        void provider.request({ method: 'eth_requestAccounts' })
        expect(send).toHaveBeenCalledTimes(2)
    })

    it('emits connect once for the first chain id it learns, then chainChanged only on a move', async () => {
        let chainId = '0x1'
        const { provider, events } = setup(async () => chainId)
        await provider.request({ method: 'eth_chainId' })
        await provider.request({ method: 'eth_chainId' })
        chainId = '0x2105'
        await provider.request({ method: 'eth_chainId' })
        expect(events).toEqual([
            ['connect', { chainId: '0x1' }],
            ['chainChanged', '0x2105'],
        ])
    })

    it('emits accountsChanged when an answer or a notification changes the accounts, and chainChanged on a notified move', async () => {
        const { provider, handleNotification, events } = setup(async () => [
            '0xab',
        ])
        await provider.request({ method: 'eth_accounts' })
        await provider.request({ method: 'eth_requestAccounts' })
        handleNotification({
            jsonrpc: '2.0',
            method: 'accountsChanged',
            params: ['0xab'],
        })
        handleNotification({
            jsonrpc: '2.0',
            method: 'accountsChanged',
            params: [],
        })
        handleNotification({
            jsonrpc: '2.0',
            method: 'chainChanged',
            params: '0x89',
        })
        handleNotification({
            jsonrpc: '2.0',
            method: 'chainChanged',
            params: '0x89',
        })
        expect(events).toEqual([
            ['accountsChanged', ['0xab']],
            ['accountsChanged', []],
            ['chainChanged', '0x89'],
        ])
    })

    it('stops calling a removed listener and survives a throwing one', () => {
        const { provider, handleNotification } = setup(async () => null)
        const thrower = vi.fn(() => {
            throw new Error('page listener blew up')
        })
        const removed = vi.fn()
        const kept = vi.fn()
        provider.on('accountsChanged', thrower)
        provider.on('accountsChanged', removed)
        provider.on('accountsChanged', kept)
        provider.removeListener('accountsChanged', removed)
        handleNotification({
            jsonrpc: '2.0',
            method: 'accountsChanged',
            params: ['0xcd'],
        })
        expect(thrower).toHaveBeenCalledTimes(1)
        expect(removed).not.toHaveBeenCalled()
        expect(kept).toHaveBeenCalledWith(['0xcd'])
    })
})
