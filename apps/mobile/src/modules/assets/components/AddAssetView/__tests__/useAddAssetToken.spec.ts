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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { addsWithoutOptIn, useAddAssetToken } from '../useAddAssetToken'

const ETHEREUM_SCOPE = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
} as const
const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const ACCOUNT = {
    id: 'account',
    name: 'Account',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'algo-address' },
        ethereum: { address: '0xtest' },
    },
} as unknown as WalletAccount
const SOURCES = [
    { address: 'algo-address', scope: ALGORAND_SCOPE },
    { address: '0xtest', scope: ETHEREUM_SCOPE },
]

const onEthereum = (
    assetId: string,
    verificationTier?: 'verified',
): ScopedAssetSearchResult => ({
    scope: ETHEREUM_SCOPE,
    asset: {
        assetId,
        name: 'USD Coin',
        unitName: 'USDC',
        peraMetadata: verificationTier ? { verificationTier } : undefined,
    },
})
const onAlgorand = (assetId: string): ScopedAssetSearchResult => ({
    scope: ALGORAND_SCOPE,
    asset: { assetId, name: 'Test Asset', unitName: 'TST' },
})

const mocks = vi.hoisted(() => ({
    addToken: vi.fn(),
    removeToken: vi.fn(),
    addedTokens: vi.fn((): unknown[] => []),
    request: vi.fn(),
    showToast: vi.fn(),
    showError: vi.fn(),
    t: vi.fn((key: string, _params?: unknown) => key),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    useAccountAddedTokensQuery: () => ({ addedTokens: mocks.addedTokens() }),
    useAddTokenMutation: () => ({ addToken: mocks.addToken }),
    useRemoveTokenMutation: () => ({ removeToken: mocks.removeToken }),
}))

// The fixture registry holds no assets adapter to read a native id from.
vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    isNativeAssetId: (_chainId: string, assetId: string) =>
        assetId === 'native',
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
    getChainDescriptor: (chainId: string) => ({
        protocol: { requiresAssetOptIn: chainId === 'algorand' },
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mocks.t }),
}))

const render = () => renderHook(() => useAddAssetToken(ACCOUNT, SOURCES))

describe('useAddAssetToken', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.addToken.mockResolvedValue(undefined)
        mocks.removeToken.mockResolvedValue(undefined)
        mocks.addedTokens.mockReturnValue([])
    })

    it('adds without opt-in only on a chain that needs none', () => {
        expect(addsWithoutOptIn('ethereum' as ChainId)).toBe(true)
        expect(addsWithoutOptIn('algorand' as ChainId)).toBe(false)
    })

    it('offers adding a token, but not the native coin or an opt-in asset', () => {
        const { result } = render()

        expect(result.current.canAddToken(onEthereum('0xUSDC'))).toBe(true)
        expect(result.current.canAddToken(onEthereum('native'))).toBe(false)
        expect(result.current.canAddToken(onAlgorand('999'))).toBe(false)
    })

    it('adds a verified token at once and confirms it', async () => {
        const { result } = render()

        await act(async () => {
            await result.current.handleAddToken(
                onEthereum('0xUSDC', 'verified'),
            )
        })

        expect(mocks.request).not.toHaveBeenCalled()
        expect(mocks.addToken).toHaveBeenCalledWith({
            accountAddress: '0xtest',
            scope: ETHEREUM_SCOPE,
            assetId: '0xUSDC',
        })
        expect(mocks.t).toHaveBeenCalledWith('add_asset.token.added_body', {
            assetName: 'USDC',
            chain: 'Ethereum',
        })
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        )
        expect(result.current.isTokenAdded(onEthereum('0xUSDC'))).toBe(true)
    })

    it('adds nothing for a result it would not offer adding', async () => {
        const { result } = render()

        await act(async () => {
            await result.current.handleAddToken(
                onEthereum('native', 'verified'),
            )
        })

        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('warns before adding an unverified token, and adds nothing if declined', async () => {
        mocks.request.mockResolvedValueOnce(undefined)
        const { result } = render()

        await act(async () => {
            await result.current.handleAddToken(onEthereum('0xNEW'))
        })

        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('adds an unverified token once the warning is accepted', async () => {
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render()

        await act(async () => {
            await result.current.handleAddToken(onEthereum('0xNEW'))
        })

        expect(mocks.addToken).toHaveBeenCalledTimes(1)
    })

    it('shows an error toast when adding fails, and leaves the token unadded', async () => {
        const failure = new Error('offline')
        mocks.addToken.mockRejectedValueOnce(failure)
        const { result } = render()

        await act(async () => {
            await result.current.handleAddToken(
                onEthereum('0xUSDC', 'verified'),
            )
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            failure,
            'add_asset.token.add_failed_title',
        )
        expect(result.current.isTokenAdded(onEthereum('0xUSDC'))).toBe(false)
        expect(result.current.isTokenPending(onEthereum('0xUSDC'))).toBe(false)
    })

    it('offers Remove only for an added token that holds nothing', () => {
        mocks.addedTokens.mockReturnValue([
            { scope: ETHEREUM_SCOPE, assetId: '0xEMPTY', hasBalance: false },
            { scope: ETHEREUM_SCOPE, assetId: '0xHELD', hasBalance: true },
        ])
        const { result } = render()

        expect(result.current.canRemoveToken(onEthereum('0xEMPTY'))).toBe(true)
        expect(result.current.canRemoveToken(onEthereum('0xHELD'))).toBe(false)
        expect(result.current.canRemoveToken(onEthereum('0xOTHER'))).toBe(false)
    })

    it('removes an added token once confirmed', async () => {
        mocks.addedTokens.mockReturnValue([
            { scope: ETHEREUM_SCOPE, assetId: '0xEMPTY', hasBalance: false },
        ])
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render()

        await act(async () => {
            await result.current.handleRemoveToken(onEthereum('0xEMPTY'))
        })

        expect(mocks.removeToken).toHaveBeenCalledWith({
            accountAddress: '0xtest',
            scope: ETHEREUM_SCOPE,
            assetId: '0xEMPTY',
        })
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'add_asset.token.removed_title' }),
        )
    })

    it('keeps the token when Remove is dismissed', async () => {
        mocks.addedTokens.mockReturnValue([
            { scope: ETHEREUM_SCOPE, assetId: '0xEMPTY', hasBalance: false },
        ])
        mocks.request.mockResolvedValueOnce(undefined)
        const { result } = render()

        await act(async () => {
            await result.current.handleRemoveToken(onEthereum('0xEMPTY'))
        })

        expect(mocks.removeToken).not.toHaveBeenCalled()
    })

    it('shows an error toast when removing fails', async () => {
        const failure = new Error('disk full')
        mocks.addedTokens.mockReturnValue([
            { scope: ETHEREUM_SCOPE, assetId: '0xEMPTY', hasBalance: false },
        ])
        mocks.request.mockResolvedValueOnce(true)
        mocks.removeToken.mockRejectedValueOnce(failure)
        const { result } = render()

        await act(async () => {
            await result.current.handleRemoveToken(onEthereum('0xEMPTY'))
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            failure,
            'add_asset.token.remove_failed_title',
        )
    })
})
