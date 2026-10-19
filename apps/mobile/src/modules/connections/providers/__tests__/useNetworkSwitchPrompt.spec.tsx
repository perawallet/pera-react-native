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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useNetworkSwitchPrompt } from '../useNetworkSwitchPrompt'

type SheetRequest = {
    id?: string
    contents: ReactElement<Record<string, unknown>>
    options?: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    dismiss: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request, dismiss: mocks.dismiss }),
}))

// Echoes the interpolation, so the copy's inputs are assertable.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, string>) =>
            options ? `${key} ${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : undefined,
    getChainDescriptor: () => ({
        networks: [
            { id: 'mainnet', displayName: 'Mainnet' },
            { id: 'sepolia', displayName: 'Sepolia' },
        ],
    }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

const REQUEST = {
    scope: { chainId: 'ethereum', networkId: 'sepolia' },
    peer: {
        name: 'Uniswap‮',
        icons: ['https://app.example/icon.png'],
    },
}

type Settle = (resolve: (value: unknown) => void) => void

const openPrompt = (settle: Settle = () => {}) => {
    mocks.request.mockImplementation(
        () => new Promise<unknown>(resolve => settle(resolve)),
    )
    const { result } = renderHook(() => useNetworkSwitchPrompt())
    const prompt = result.current(REQUEST as never)
    const [request] = mocks.request.mock.calls[0] as [SheetRequest]
    return { prompt, request }
}

describe('useNetworkSwitchPrompt', () => {
    beforeEach(() => {
        mocks.request.mockReset()
        mocks.dismiss.mockReset()
    })

    it('opens a sheet naming the dApp, the chain and the network, with no way out but its two buttons', () => {
        const { request } = openPrompt()

        expect(request.contents.type).toBe(ConfirmActionContent)
        expect(request.contents.props).toMatchObject({
            iconUrl: 'https://app.example/icon.png',
            title: 'walletconnect.switch_network.title',
            confirmLabel: 'walletconnect.switch_network.confirm',
            cancelLabel: 'common.cancel.label',
        })
        const message = String(request.contents.props.message)
        expect(message).toContain('"name":"Uniswap"')
        expect(message).toContain('"chain":"Ethereum"')
        expect(message).toContain('"network":"Sepolia"')
        expect(request.options).toMatchObject({
            enablePanDownToClose: false,
            enableCloseOnBackdropPress: false,
        })
    })

    it('decides true when the sheet resolves true', async () => {
        const { prompt } = openPrompt(resolve => resolve(true))

        await expect(prompt.decision).resolves.toBe(true)
    })

    it.each([
        ['cancel or backdrop', undefined],
        ['an unexpected value', 'continue'],
    ])('decides false on %s', async (_name, value) => {
        const { prompt } = openPrompt(resolve => resolve(value))

        await expect(prompt.decision).resolves.toBe(false)
    })

    it('dismisses the very sheet it opened', () => {
        const { prompt, request } = openPrompt()

        prompt.dismiss()

        expect(mocks.dismiss).toHaveBeenCalledWith(request.id)
        expect(request.id).toEqual(expect.any(String))
    })
})
