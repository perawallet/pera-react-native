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
import { WatchAssetContent } from '../../components/WatchAssetContent'
import { useWatchAssetPrompt } from '../useWatchAssetPrompt'

type SheetRequest = {
    id?: string
    contents: ReactElement<Record<string, unknown>>
    options?: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    dismiss: vi.fn(),
    addToken: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request, dismiss: mocks.dismiss }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAddTokenMutation: () => ({ addToken: mocks.addToken }),
}))

vi.mock('../../components/WatchAssetContent', () => ({
    WatchAssetContent: () => null,
}))

const REQUEST = {
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    assetId: '0xToken',
    accountAddress: '0xAccount',
    peer: { name: 'Uniswap', icons: [] },
}

const openPrompt = (result: unknown) => {
    mocks.request.mockImplementation(() => Promise.resolve(result))
    const { result: hook } = renderHook(() => useWatchAssetPrompt())
    const prompt = hook.current(REQUEST as never)
    const [request] = mocks.request.mock.calls[0] as [SheetRequest]
    return { prompt, request }
}

describe('useWatchAssetPrompt', () => {
    beforeEach(() => {
        mocks.request.mockReset()
        mocks.dismiss.mockReset()
        mocks.addToken.mockReset()
        mocks.addToken.mockResolvedValue(undefined)
    })

    it('opens the watch-asset sheet for the token, account and dApp, with no way out but its buttons', () => {
        const { request } = openPrompt(undefined)

        expect(request.contents.type).toBe(WatchAssetContent)
        expect(request.contents.props).toMatchObject({
            scope: REQUEST.scope,
            assetId: REQUEST.assetId,
            accountAddress: REQUEST.accountAddress,
            peer: REQUEST.peer,
        })
        expect(request.options).toMatchObject({
            enablePanDownToClose: false,
            enableCloseOnBackdropPress: false,
        })
    })

    it('adds the token to the account and decides true on approval', async () => {
        const { prompt } = openPrompt('add')

        await expect(prompt.decision).resolves.toBe(true)
        expect(mocks.addToken).toHaveBeenCalledWith({
            accountAddress: '0xAccount',
            scope: REQUEST.scope,
            assetId: '0xToken',
        })
    })

    it('decides false and adds nothing when the user cancels', async () => {
        const { prompt } = openPrompt(undefined)

        await expect(prompt.decision).resolves.toBe(false)
        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('decides false, adding nothing, when the sheet is cancelled after a network failure', async () => {
        const { prompt } = openPrompt('cancel')

        await expect(prompt.decision).resolves.toBe(false)
        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('rejects as an invalid payload, adding nothing, when the address holds no token', async () => {
        const { prompt } = openPrompt('unreadable')

        await expect(prompt.decision).rejects.toMatchObject({
            code: 'invalid-payload',
        })
        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('rejects the decision when the add fails, so the dApp hears of it', async () => {
        const failure = new Error('database closed')
        mocks.addToken.mockRejectedValue(failure)
        const { prompt } = openPrompt('add')

        await expect(prompt.decision).rejects.toBe(failure)
    })

    it('dismisses the very sheet it opened', () => {
        const { prompt, request } = openPrompt(undefined)

        prompt.dismiss()

        expect(mocks.dismiss).toHaveBeenCalledWith(request.id)
        expect(request.id).toEqual(expect.any(String))
    })
})
