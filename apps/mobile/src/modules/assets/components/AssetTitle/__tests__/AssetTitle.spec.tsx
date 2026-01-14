/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import AssetTitle from '../AssetTitle'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'

// Mock AssetIcon to keep test focused
vi.mock('../AssetIcon', () => ({
    default: () => null,
}))

vi.mock('@hooks/theme', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

describe('AssetTitle', () => {
    it('renders Algo title', () => {
        const asset = {
            assetId: ALGO_ASSET_ID,
            name: 'Algorand',
        } as any
        render(<AssetTitle asset={asset} />)

        expect(screen.getByText('Algo')).toBeTruthy()
        expect(screen.getByTestId('icon-assets/trusted')).toBeTruthy()
    })

    it('renders verified asset title', () => {
        const asset = {
            assetId: 123,
            name: 'Test Asset',
            peraMetadata: { verificationTier: 'verified' },
        } as any
        render(<AssetTitle asset={asset} />)

        expect(screen.getByText('Test Asset')).toBeTruthy()
        expect(screen.getByTestId('icon-assets/verified')).toBeTruthy()
    })

    it('renders suspicious asset title', () => {
        const asset = {
            assetId: 456,
            name: 'Bad Asset',
            peraMetadata: { verificationTier: 'suspicious' },
        } as any
        render(<AssetTitle asset={asset} />)

        expect(screen.getByText('Bad Asset')).toBeTruthy()
        expect(screen.getByTestId('icon-assets/suspicious')).toBeTruthy()
    })
})
