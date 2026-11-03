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
import { useWidgetWipeStore } from '../../store'
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
    priceFeed: null,
    portfolioFeed: null,
    assetOptions: [],
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
    backup: {
        cloud: { state: 'backedUp', title: 'Backed up', detail: null },
        passphrase: { state: 'backedUp', title: 'All backed up', detail: null },
    },
    receiveTargets: [
        {
            address: 'ADDR',
            name: 'Main',
            paymentUri: 'algorand://ADDR',
            chain: 'algorand:mainnet',
        },
    ],
    inboxFeed: {
        deviceId: 'device-1',
        addresses: ['ADDR'],
        localAddresses: ['ADDR'],
        accountNames: [{ address: 'ADDR', name: 'Main' }],
        notifications: null,
    },
    ...overrides,
})

const lastWritten = () =>
    JSON.parse(widgets().writeSnapshot.mock.calls.at(-1)![0])

const captureAppStateListeners = () => {
    const listeners: ((state: string) => void)[] = []
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        listeners.push(listener as (state: string) => void)
        return { remove: vi.fn() } as never
    })
    return () => listeners.forEach(listener => listener('background'))
}

describe('useWidgetSnapshotWriter', () => {
    beforeEach(() => {
        useWidgetWipeStore.getState().resetState()
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

    it('purges the images only once while privacy mode stays on', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            { initialProps: input({ isPrivacyMode: true }) },
        )
        await waitFor(() =>
            expect(widgets().syncImages).toHaveBeenCalledTimes(1),
        )

        rerender(input({ isPrivacyMode: true, locale: 'de' }))
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )

        expect(widgets().syncImages).toHaveBeenCalledTimes(1)
    })

    it('writes the hidden shape at once when privacy turns on while price and backup are pending', async () => {
        const background = captureAppStateListeners()
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            { initialProps: input() },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        rerender(
            input({
                isPrivacyMode: true,
                algoPrice: undefined,
                backup: undefined,
                portfolio: undefined,
                nfts: undefined,
            }),
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(2),
        )
        expect(lastWritten()).toMatchObject({
            portfolio: { state: 'hidden' },
            receiveTargets: null,
        })

        // The background re-write must not bring the visible snapshot back.
        act(background)
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(3),
        )
        expect(lastWritten().portfolio).toEqual({ state: 'hidden' })
    })

    // An empty list would purge every cached image after a read error.
    it('leaves the image cache alone when the NFT read failed', async () => {
        renderHook(() => useWidgetSnapshotWriter(input({ nfts: null })))

        await waitFor(() => expect(widgets().writeSnapshot).toHaveBeenCalled())
        expect(widgets().syncImages).not.toHaveBeenCalled()
        expect(lastWritten().nfts).toBeNull()
    })

    it('writes nothing while a wipe is under way, not even on backgrounding', async () => {
        const background = captureAppStateListeners()
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            { initialProps: input() },
        )
        await waitFor(() =>
            expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1),
        )

        act(() => useWidgetWipeStore.getState().beginWipe())
        rerender(input({ locale: 'de' }))
        act(background)
        await act(async () => {})

        expect(widgets().writeSnapshot).toHaveBeenCalledTimes(1)
        expect(widgets().syncImages).toHaveBeenCalledTimes(1)
    })

    it('drops a run whose image download a wipe overtook, and clears what it fetched', async () => {
        let finishSync: (keys: string[]) => void = () => {}
        widgets().syncImages.mockImplementation(
            () =>
                new Promise<string[]>(resolve => {
                    finishSync = resolve
                }),
        )
        renderHook(() => useWidgetSnapshotWriter(input()))
        await waitFor(() => expect(widgets().syncImages).toHaveBeenCalled())

        act(() => {
            useWidgetWipeStore.getState().beginWipe()
            // The stores reset before the download finishes.
            useWidgetWipeStore.getState().resetState()
        })
        await act(async () => finishSync(['7']))

        expect(widgets().writeSnapshot).not.toHaveBeenCalled()
        expect(widgets().clearSnapshot).toHaveBeenCalledTimes(1)
    })

    it('clears again once the wipe has removed the accounts', async () => {
        const { rerender } = renderHook(
            props => useWidgetSnapshotWriter(props),
            { initialProps: input({ hasAccounts: false }) },
        )
        await waitFor(() =>
            expect(widgets().clearSnapshot).toHaveBeenCalledTimes(1),
        )

        act(() => {
            useWidgetWipeStore.getState().beginWipe()
            useWidgetWipeStore.getState().endWipe()
        })
        rerender(input({ hasAccounts: false, locale: 'de' }))

        await waitFor(() =>
            expect(widgets().clearSnapshot).toHaveBeenCalledTimes(2),
        )
    })
})
