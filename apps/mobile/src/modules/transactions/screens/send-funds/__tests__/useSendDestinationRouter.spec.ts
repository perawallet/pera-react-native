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

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useSendDestinationRouter } from '../useSendDestinationRouter'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    showToast: vi.fn(),
    setSendMode: vi.fn(),
    setDestination: vi.fn(),
}))

const RECEIVER = 'R'.repeat(58)

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: () => ({
        selectedAssetId: '123',
        setDestination: mocks.setDestination,
        setSendMode: mocks.setSendMode,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    canSignWith: () => false,
    useAllAccounts: () => [{ chains: { algorand: { address: RECEIVER } } }],
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    useAccountBalancesQuery: () => ({
        accountBalances: new Map(),
        isPending: false,
    }),
    useOnChainAccountStateQuery: () => ({
        data: undefined,
        isFetching: false,
        isSuccess: false,
        isError: false,
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useIsNativeAssetId: () => () => false,
    useAssetsQuery: () => ({
        data: new Map([['123', { assetId: '123' }]]),
        isFetched: true,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

describe('useSendDestinationRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
    })

    // A local receiver that holds no opt-in and can't be signed for has only
    // the ARC-59 inbox as a way to receive the asset.
    it('routes an un-opted-in local receiver through the asset inbox', () => {
        const { result } = renderHook(() => useSendDestinationRouter())

        act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.navigate).toHaveBeenCalledWith('ARC59SendSummary')
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('refuses the inbox route with a notice while the assetInbox capability is off', () => {
        setCapabilityOverrides({ assetInbox: false })
        const { result } = renderHook(() => useSendDestinationRouter())

        act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })
})
