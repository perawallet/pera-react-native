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
import { AppState } from 'react-native'
import { act, renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { BuildWidgetSnapshotInput } from '../../snapshot'
import {
    useWidgetSnapshotWriter,
    type WidgetSnapshotWriterInput,
} from '../useWidgetSnapshotWriter'

const widgets = () =>
    getProvider().widgets as unknown as {
        writeSnapshot: ReturnType<typeof vi.fn>
        clearSnapshot: ReturnType<typeof vi.fn>
        syncImages: ReturnType<typeof vi.fn>
    }

const input = (
    overrides: Partial<BuildWidgetSnapshotInput> = {},
): WidgetSnapshotWriterInput => ({
    locale: 'en',
    theme: 'system',
    network: { isMainnet: true, label: 'MainNet' },
    strings: { updated: 'Updated' },
    isPrivacyMode: false,
    hasAccounts: true,
    algoPrice: { value: new Decimal('0.2'), currencyCode: 'USD', asOf: 1 },
    portfolio: {
        value: new Decimal('10'),
        currencyCode: 'USD',
        algoValue: new Decimal('50'),
        asOf: 1,
    },
    nfts: [{ assetId: '7', title: 'Seven', imageUrl: 'https://x/7.png' }],
    ...overrides,
})

const lastWritten = () =>
    JSON.parse(widgets().writeSnapshot.mock.calls.at(-1)![0])

describe('useWidgetSnapshotWriter', () => {
    beforeEach(() => {
        widgets().writeSnapshot.mockClear()
        widgets().clearSnapshot.mockClear()
        widgets()
            .syncImages.mockReset()
            .mockImplementation(async (items: { key: string }[]) =>
                items.map(item => item.key),
            )
    })

    it('writes a ready snapshot once and not again for identical input', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            {
                initialProps: input(),
            },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(input())
        await act(async () => {})

        expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1)
    })

    it('rewrites when the language changes', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            {
                initialProps: input(),
            },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(input({ locale: 'de', strings: { updated: 'Aktualisiert' } }))

        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )
        expect(lastWritten()).toMatchObject({
            locale: 'de',
            strings: { updated: 'Aktualisiert' },
        })
    })

    it('rewrites when the network changes', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            {
                initialProps: input(),
            },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(input({ network: { isMainnet: false, label: 'TestNet' } }))

        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )
        expect(lastWritten().network).toEqual({
            isMainnet: false,
            label: 'TestNet',
        })
    })

    it('never writes while the price or portfolio is still loading', async () => {
        renderHook(() =>
            useWidgetSnapshotWriter(input({ algoPrice: undefined })),
        )
        renderHook(() =>
            useWidgetSnapshotWriter(input({ portfolio: undefined })),
        )
        await act(async () => {})

        expect(widgets().writeSnapshot).not.toHaveBeenCalled()
    })

    it('does not purge cached images while NFTs are still loading', async () => {
        renderHook(() => useWidgetSnapshotWriter(input({ nfts: undefined })))
        await act(async () => {})

        expect(widgets().syncImages).not.toHaveBeenCalled()
    })

    it('purges images and writes hidden when privacy mode turns on', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            {
                initialProps: input(),
            },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(input({ isPrivacyMode: true, nfts: undefined }))

        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )
        expect(widgets().syncImages).toHaveBeenLastCalledWith([])
        expect(lastWritten()).toMatchObject({
            portfolio: { state: 'hidden' },
            nfts: { state: 'hidden' },
        })
    })

    it('only lists NFTs whose image the native side cached', async () => {
        widgets().syncImages.mockResolvedValue([])

        renderHook(() => useWidgetSnapshotWriter(input()))

        await waitFor(() => expect(widgets().writeSnapshot).toHaveBeenCalled())
        expect(lastWritten().nfts).toEqual({ state: 'visible', items: [] })
    })

    it('writes again when the app goes to the background', async () => {
        const listeners: ((state: string) => void)[] = []
        vi.spyOn(AppState, 'addEventListener').mockImplementation(
            (_, listener) => {
                listeners.push(listener as (state: string) => void)
                return { remove: vi.fn() } as never
            },
        )
        renderHook(() => useWidgetSnapshotWriter(input()))
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        act(() => listeners.forEach(listener => listener('background')))

        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )
    })

    it('clears the snapshot once when there are no accounts', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            {
                initialProps: input({ hasAccounts: false }),
            },
        )
        await waitFor(() =>
            expect(widgets().clearSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(input({ hasAccounts: false, locale: 'de' }))
        await act(async () => {})

        expect(widgets().clearSnapshot).toHaveBeenCalledTimes(1)
        expect(widgets().writeSnapshot).not.toHaveBeenCalled()
    })
})
