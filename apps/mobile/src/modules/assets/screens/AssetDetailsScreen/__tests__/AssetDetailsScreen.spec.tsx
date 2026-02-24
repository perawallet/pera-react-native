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

import React from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import {
    AssetDetailsScreen,
    AssetDetailsScreenProps,
} from '../AssetDetailsScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-accounts')
    return {
        ...(actual as Record<string, unknown>),
        useSelectedAccount: vi.fn(() => ({
            address: 'test-address',
            name: 'Test Wallet',
        })),
        getAccountDisplayName: vi.fn(() => 'Test Wallet'),
    }
})

vi.mock('@perawallet/wallet-core-assets', () => ({
    useSingleAssetDetailsQuery: vi.fn(() => ({
        data: { assetId: '123', name: 'Algorand', unitName: 'ALGO' },
        isPending: false,
    })),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: vi.fn(addr => `${addr.substring(0, 4)}...`),
        formatDatetime: vi.fn(() => 'Jan 1, 2024'),
    }
})

const { capturedHoldingsProps, capturedMarketsProps } = vi.hoisted(() => ({
    capturedHoldingsProps: { current: {} as Record<string, unknown> },
    capturedMarketsProps: { current: {} as Record<string, unknown> },
}))

vi.mock('@modules/assets/components/holdings/AssetHoldings', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AssetHoldings: (props: any) => {
        capturedHoldingsProps.current = props
        return <div data-testid='AssetHoldings' />
    },
}))

vi.mock('@modules/assets/components/market/AssetMarkets', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AssetMarkets: (props: any) => {
        capturedMarketsProps.current = props
        return <div data-testid='AssetMarkets' />
    },
}))

vi.mock('@components/core/PWTabView/PWTabView', () => ({
    createPWTabNavigator: () => ({
        Navigator: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        Screen: ({ children }: { children: unknown }) => {
            // In tests, just render children if it's a function or directly
            return typeof children === 'function'
                ? children({ navigation: {} })
                : children
        },
    }),
}))

describe('AssetDetailsScreen', () => {
    it('sets up header with account name and address via useNavigationHeader', () => {
        render(
            <AssetDetailsScreen
                route={
                    {
                        params: { assetId: '123' },
                    } as AssetDetailsScreenProps['route']
                }
                navigation={
                    {} as unknown as AssetDetailsScreenProps['navigation']
                }
            />,
        )

        expect(useNavigationHeader).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.anything(),
                right: expect.anything(),
            }),
        )
    })

    it('renders AssetHoldings by default', () => {
        render(
            <AssetDetailsScreen
                route={
                    {
                        params: { assetId: '123' },
                    } as AssetDetailsScreenProps['route']
                }
                navigation={
                    {} as unknown as AssetDetailsScreenProps['navigation']
                }
            />,
        )

        expect(screen.getByTestId('AssetHoldings')).toBeTruthy()
    })

    it('passes onSwipeEnabledChange to AssetHoldings', () => {
        render(
            <AssetDetailsScreen
                route={
                    {
                        params: { assetId: '123' },
                    } as AssetDetailsScreenProps['route']
                }
                navigation={
                    {} as unknown as AssetDetailsScreenProps['navigation']
                }
            />,
        )

        expect(capturedHoldingsProps.current.onSwipeEnabledChange).toBeTypeOf(
            'function',
        )
    })

    it('passes onSwipeEnabledChange to AssetMarkets', () => {
        render(
            <AssetDetailsScreen
                route={
                    {
                        params: { assetId: '123' },
                    } as AssetDetailsScreenProps['route']
                }
                navigation={
                    {} as unknown as AssetDetailsScreenProps['navigation']
                }
            />,
        )

        expect(capturedMarketsProps.current.onSwipeEnabledChange).toBeTypeOf(
            'function',
        )
    })
})
