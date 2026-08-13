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

import React from 'react'
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Linking } from 'react-native'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import { useReturnToDappStore } from '../../../stores/useReturnToDappStore'
import { ConnectionSuccessContent } from '../ConnectionSuccessContent'

const request = {
    clientId: 'client-1',
    chainId: 416_001,
    permissions: [],
    createdAt: 0,
    peerMeta: {
        name: 'TestDApp',
        url: 'https://dapp.example.org',
        description: '',
        icons: [],
    },
} as unknown as WalletConnectSessionRequest

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ConnectionSuccessContent request={request} />
        </BottomSheetIdContext.Provider>,
    )

describe('ConnectionSuccessContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        useReturnToDappStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('shows only the Close button when no return context exists', () => {
        renderWithId()

        expect(screen.getByText('common.close.label')).toBeTruthy()
        expect(
            screen.queryByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeNull()
    })

    it('shows only the Close button for a qr-originated pairing (no browser to return to)', () => {
        useReturnToDappStore
            .getState()
            .setReturnContext('client-1', { origin: 'qr' })

        renderWithId()

        expect(screen.getByText('common.close.label')).toBeTruthy()
        expect(
            screen.queryByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeNull()
    })

    it('offers Return to the dApp alongside Close when a return context exists', () => {
        useReturnToDappStore.getState().setReturnContext('client-1', {
            origin: 'external-browser',
            browserName: 'Chrome',
        })

        renderWithId()

        expect(
            screen.getByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeTruthy()
        expect(screen.getByText('common.close.label')).toBeTruthy()
    })

    it('returns to the initiating browser and resolves the sheet on tap', async () => {
        vi.mocked(Linking.openURL).mockResolvedValue(true)
        useReturnToDappStore.getState().setReturnContext('client-1', {
            origin: 'external-browser',
            browserName: 'Chrome',
        })
        const promise = useBottomSheetStore
            .getState()
            .request<boolean>({ id: 'sheet-1', contents: null })

        renderWithId('sheet-1')
        fireEvent.click(
            screen.getByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        )

        expect(Linking.openURL).toHaveBeenCalledWith(
            'googlechrome://',
        )
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe(true)
    })

    it('hides the CTA when the browser has no focus scheme (iOS Safari)', () => {
        useReturnToDappStore.getState().setReturnContext('client-1', {
            origin: 'external-browser',
            browserName: 'Mobile Safari',
        })

        renderWithId()

        expect(
            screen.queryByText(
                'walletconnect.request.success_sheet_return_to_dapp',
            ),
        ).toBeNull()
        expect(screen.getByText('common.close.label')).toBeTruthy()
    })
})
