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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { webViewDappTransport } from '../../../utils/webViewDappTransport'
import { useEip1193Bridge } from '../useEip1193Bridge'

const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn(() => true) }))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapabilityCheck: () => mockCheck,
}))

vi.mock('@perawallet/wallet-core-dapp', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-dapp')>()),
    eip155ChainIds: () => ['ethereum', 'base'],
}))

const pageMessage = {
    provider: 'eip1193',
    token: 't',
    hasUserActivation: true,
    request: { jsonrpc: '2.0', id: 'r1', method: 'eth_chainId' },
}

const webview = { current: { injectJavaScript: vi.fn() } } as never

describe('useEip1193Bridge', () => {
    beforeEach(() => {
        mockCheck.mockReturnValue(true)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('injects no provider when the host does not enable Pera Connect', () => {
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: false }),
        )

        expect(result.current.injectedScript).toBeUndefined()
    })

    it('injects no provider when no EVM chain accepts dApp connections', () => {
        mockCheck.mockReturnValue(false)

        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )

        expect(result.current.injectedScript).toBeUndefined()
    })

    it('injects the provider carrying the bridge token when an EVM chain accepts dApps', () => {
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )

        expect(result.current.injectedScript).toContain('"tok"')
    })

    it('attaches the page on mount and detaches it on unmount', () => {
        const detach = vi.fn()
        const attach = vi
            .spyOn(webViewDappTransport, 'attach')
            .mockReturnValue(detach)

        const { unmount } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )
        expect(attach).toHaveBeenCalledTimes(1)

        unmount()
        expect(detach).toHaveBeenCalledTimes(1)
    })

    it('forwards a provider message with its posting url and claims it', () => {
        const receive = vi
            .spyOn(webViewDappTransport, 'receive')
            .mockImplementation(() => {})
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )

        const isClaimed = result.current.handleMessage(
            pageMessage,
            'https://app.uniswap.org/swap',
        )

        expect(isClaimed).toBe(true)
        expect(receive).toHaveBeenCalledWith(
            expect.objectContaining({ currentUrl: expect.any(Function) }),
            pageMessage,
            'https://app.uniswap.org/swap',
        )
    })

    it('leaves a Pera bridge message unclaimed', () => {
        const receive = vi.spyOn(webViewDappTransport, 'receive')
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )

        const isClaimed = result.current.handleMessage(
            { jsonrpc: '2.0', id: 1, method: 'getAddresses', token: 'tok' },
            'https://app.uniswap.org/',
        )

        expect(isClaimed).toBe(false)
        expect(receive).not.toHaveBeenCalled()
    })

    it('still forwards a provider message once no EVM chain accepts dApps, so the page is answered', () => {
        mockCheck.mockReturnValue(false)
        const receive = vi
            .spyOn(webViewDappTransport, 'receive')
            .mockImplementation(() => {})
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )

        expect(
            result.current.handleMessage(pageMessage, 'https://a.xyz/'),
        ).toBe(true)
        expect(receive).toHaveBeenCalledTimes(1)
    })

    it('swallows a provider message without forwarding it when the host is not a dApp host', () => {
        const receive = vi.spyOn(webViewDappTransport, 'receive')
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: false }),
        )

        expect(
            result.current.handleMessage(pageMessage, 'https://a.xyz/'),
        ).toBe(true)
        expect(receive).not.toHaveBeenCalled()
    })

    it('answers nothing to a page that has navigated to another origin since it asked', async () => {
        const { result } = renderHook(() =>
            useEip1193Bridge({ webview, bridgeToken: 'tok', isEnabled: true }),
        )
        let respond: Parameters<
            Parameters<typeof webViewDappTransport.onRequest>[0]
        >[2] = async () => {}
        const stop = webViewDappTransport.onRequest(
            (_ctx, _request, answer) => {
                respond = answer
            },
        )

        result.current.handleMessage(pageMessage, 'https://a.xyz/')
        result.current.trackNavigation('https://b.xyz/')

        await expect(
            respond({ jsonrpc: '2.0', id: 'r1', result: '0x1' }),
        ).rejects.toThrow()
        stop()
    })
})
