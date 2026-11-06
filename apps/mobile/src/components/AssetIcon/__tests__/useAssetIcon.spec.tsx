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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { render, screen } from '@test-utils/render'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { useAssetIcon } from '../useAssetIcon'

const asset = (overrides: Partial<DisplayableAsset> = {}): DisplayableAsset =>
    ({
        assetId: '31566704',
        unitName: 'Pera USD',
        ...overrides,
    }) as DisplayableAsset

describe('useAssetIcon', () => {
    it('falls back to the asset initials when it has no logo', () => {
        const { result } = renderHook(() =>
            useAssetIcon({
                asset: asset(),
                chainId: 'algorand',
                svgProps: {},
            }),
        )

        render(<>{result.current.icon}</>)

        expect(screen.getByText('PU')).toBeTruthy()
    })

    it("draws a token's stored logo, not its initials, on an EVM chain", () => {
        const { result } = renderHook(() =>
            useAssetIcon({
                asset: asset({
                    assetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                    unitName: 'USDC',
                    peraMetadata: { logo: 'https://pera.test/usdc.png' },
                }),
                chainId: 'ethereum',
                svgProps: {},
            }),
        )

        render(<>{result.current.icon}</>)

        expect(screen.queryByText('US')).toBeNull()
        const { source } = result.current.icon.props as {
            source: { uri: string }
        }
        expect(source.uri).toContain('https://pera.test/usdc.png?width=')
    })
})
