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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { useWatchAssetContent } from '../useWatchAssetContent'

const mocks = vi.hoisted(() => ({
    useSingleAssetDetailsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    PeraAssetVerificationTier: {
        verified: 'verified',
        suspicious: 'suspicious',
        unverified: 'unverified',
    },
    useSingleAssetDetailsQuery: mocks.useSingleAssetDetailsQuery,
}))

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    addressCodecs: {
        get: () => ({
            truncate: (address: string) => `${address.slice(0, 6)}…`,
        }),
    },
    i18nKey: (key: string) => key,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : undefined,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/walletconnect', () => ({
    getPreferredDappIcon: (icons?: string[]) => icons?.[0],
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const PEER = {
    name: 'Uniswap‮',
    icons: ['https://app.example/icon.png'],
}

const query = (state: Record<string, unknown>) =>
    mocks.useSingleAssetDetailsQuery.mockReturnValue({
        data: undefined,
        isError: false,
        isPending: false,
        ...state,
    })

const read = () =>
    renderHook(() =>
        useWatchAssetContent({ scope: SCOPE, assetId: '0xToken', peer: PEER }),
    ).result.current

describe('useWatchAssetContent', () => {
    beforeEach(() => mocks.useSingleAssetDetailsQuery.mockReset())

    it('reads the token from the chain and Pera, never the local database', () => {
        query({ isPending: true })

        read()

        expect(mocks.useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            '0xToken',
            SCOPE,
            false,
        )
    })

    it('is loading while the read is pending', () => {
        query({ isPending: true })

        expect(read()).toMatchObject({ isLoading: true, isUnreadable: false })
    })

    it('is unreadable when the read fails for a reason that is not the network', () => {
        query({ isError: true, error: new Error('execution reverted') })

        expect(read()).toMatchObject({
            isLoading: false,
            isUnreadable: true,
            isNetworkFailure: false,
        })
    })

    it.each(['offline', 'timeout', 'server'] as const)(
        'is a network failure, not an unreadable token, when the node is down (%s)',
        kind => {
            query({ isError: true, error: new PeraNetworkError(kind) })

            expect(read()).toMatchObject({
                isLoading: false,
                isUnreadable: false,
                isNetworkFailure: true,
            })
        },
    )

    it('exposes the asset it read, with its tier', () => {
        const asset = {
            assetId: '0xToken',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: { verificationTier: 'verified' },
        }
        query({ data: asset })

        expect(read()).toMatchObject({
            asset,
            isLoading: false,
            isSuspicious: false,
            tierLabel: 'walletconnect.watch_asset.tier.verified',
        })
    })

    it('flags a suspicious token', () => {
        query({
            data: {
                assetId: '0xToken',
                peraMetadata: { verificationTier: 'suspicious' },
            },
        })

        expect(read()).toMatchObject({
            isSuspicious: true,
            tierLabel: 'walletconnect.watch_asset.tier.suspicious',
        })
    })

    it('reads a token with no Pera record as unverified', () => {
        query({ data: { assetId: '0xToken' } })

        expect(read()).toMatchObject({
            isSuspicious: false,
            tierLabel: 'walletconnect.watch_asset.tier.unverified',
        })
    })

    it('labels the token by symbol, then name, then contract', () => {
        query({
            data: { assetId: '0xToken', unitName: 'USDC', name: 'USD Coin' },
        })
        expect(read()).toMatchObject({
            assetLabel: 'USDC',
            truncatedContract: '0xToken'.slice(0, 6) + '…',
        })

        query({ data: { assetId: '0xToken', name: 'USD Coin' } })
        expect(read().assetLabel).toBe('USD Coin')

        query({ isPending: true })
        expect(read().assetLabel).toBe('0xToken')
    })

    it('names the chain and the dApp, with the dApp name made safe to show', () => {
        query({ isPending: true })

        expect(read()).toMatchObject({
            chainName: 'Ethereum',
            peerName: 'Uniswap',
            peerIconUrl: 'https://app.example/icon.png',
        })
    })
})
