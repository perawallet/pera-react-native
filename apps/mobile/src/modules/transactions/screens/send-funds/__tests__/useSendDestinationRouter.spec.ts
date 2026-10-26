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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useSendDestinationRouter } from '../useSendDestinationRouter'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    showToast: vi.fn(),
    setSendMode: vi.fn(),
    setDestination: vi.fn(),
    isValidAddress: vi.fn<(address: string) => boolean>(),
    screenRecipient: vi.fn<(address: string) => Promise<boolean>>(),
}))

const RECEIVER = 'R'.repeat(58)

vi.mock('@modules/transactions/hooks', () => ({
    useSendScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
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

vi.mock('../useRecipientPoisoningGate', () => ({
    useRecipientPoisoningGate: () => ({
        screenRecipient: mocks.screenRecipient,
        isScreeningRecipient: false,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

describe('useSendDestinationRouter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        mocks.isValidAddress.mockReturnValue(true)
        mocks.screenRecipient.mockResolvedValue(true)
        addressCodecs.register({
            ...fixtureCodec,
            chainId: 'algorand',
            isValid: address => mocks.isValidAddress(address),
        })
        sendFlowChainAdapters.register({
            chainId: 'algorand',
            buildTransferTxs: vi.fn(),
            transactionFee: vi.fn(),
        })
    })

    afterEach(() => {
        addressCodecs.reset()
        sendFlowChainAdapters.reset()
    })

    it("refuses a receiver the send chain's codec rejects and clears it", async () => {
        mocks.isValidAddress.mockReturnValue(false)
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination('0xabc'))

        expect(mocks.setDestination).toHaveBeenCalledWith(undefined)
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'send_funds.destination.invalid_address_title',
                type: 'error',
            }),
        )
    })

    it('sends any asset as a plain transfer on a chain without opt-in routing', async () => {
        sendFlowChainAdapters.reset()
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.setSendMode).toHaveBeenCalledWith('normal')
        expect(mocks.navigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    // A local receiver that holds no opt-in and can't be signed for has only
    // the ARC-59 inbox as a way to receive the asset.
    it('routes an un-opted-in local receiver through the asset inbox', async () => {
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.navigate).toHaveBeenCalledWith('AssetInboxSendSummary')
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('refuses the inbox route with a notice while the assetInbox capability is off', async () => {
        setCapabilityOverrides({ assetInbox: false })
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('screens the receiver before routing it', async () => {
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.screenRecipient).toHaveBeenCalledWith(RECEIVER)
        expect(mocks.setDestination).toHaveBeenCalledWith(RECEIVER)
        expect(mocks.screenRecipient.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.navigate.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it('ignores a second receiver while the first is still being screened', async () => {
        let approve: (isApproved: boolean) => void = () => {}
        mocks.screenRecipient.mockReturnValue(
            new Promise(resolve => {
                approve = resolve
            }),
        )
        const { result } = renderHook(() => useSendDestinationRouter())

        let first: Promise<void> = Promise.resolve()
        await act(async () => {
            first = result.current.resolveDestination(RECEIVER)
            await result.current.resolveDestination(RECEIVER)
        })
        await act(async () => {
            approve(true)
            await first
        })

        expect(mocks.screenRecipient).toHaveBeenCalledTimes(1)
        expect(mocks.navigate).toHaveBeenCalledTimes(1)
    })

    it('clears the receiver and stays put when the user backs out of the warning', async () => {
        mocks.screenRecipient.mockResolvedValue(false)
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination(RECEIVER))

        expect(mocks.setDestination).toHaveBeenCalledWith(undefined)
        expect(mocks.setDestination).not.toHaveBeenCalledWith(RECEIVER)
        expect(mocks.navigate).not.toHaveBeenCalled()
        expect(mocks.setSendMode).not.toHaveBeenCalled()
    })

    it('never screens an address the codec rejects', async () => {
        mocks.isValidAddress.mockReturnValue(false)
        const { result } = renderHook(() => useSendDestinationRouter())

        await act(() => result.current.resolveDestination('0xabc'))

        expect(mocks.screenRecipient).not.toHaveBeenCalled()
    })
})
