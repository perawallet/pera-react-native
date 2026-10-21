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

import { useCallback } from 'react'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { findNativeAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainFamily,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useSendAccountResolver,
    useSendFundsStore,
} from '@modules/transactions'
import { ContactSendNetworkContent } from '../components/ContactSendNetworkContent'

export type UseSendToContactResult = {
    /** Whether some account of the user's can send on a network of the family. */
    canSendOn: (family: ChainFamily) => boolean
    sendTo: (family: ChainFamily, address: string) => Promise<void>
}

const SEND_SHEET_OPTIONS = {
    size: 'modal',
    enablePanDownToClose: true,
    autoCreateContainer: false,
} as const

const chainsByFamily = (): Map<ChainFamily, ChainId[]> => {
    const byFamily = new Map<ChainFamily, ChainId[]>()
    for (const { id, family } of getProvider().chains.list()) {
        byFamily.set(family, [...(byFamily.get(family) ?? []), id])
    }
    return byFamily
}

export const useSendToContact = (): UseSendToContactResult => {
    // resolveSender reads the accounts store when called; subscribing here
    // re-renders, so the networks below re-derive when an account changes.
    useAccountsStore(state => state.accounts)
    const isCapable = useChainCapabilityCheck()
    const { resolve: resolveSender, pick: pickSender } =
        useSendAccountResolver()
    const { request, requestByType } = useBottomSheet()

    const byFamily = chainsByFamily()
    const sendableChains = (family: ChainFamily) =>
        (byFamily.get(family) ?? []).filter(
            chainId =>
                isCapable({ chain: { chainId, capability: 'send' } }) &&
                resolveSender(chainId).kind !== 'none',
        )

    const canSendOn = (family: ChainFamily) => sendableChains(family).length > 0

    const openSend = useCallback(
        (sender: WalletAccount, chainId: ChainId, address: string) => {
            useAccountsStore.getState().setSelectedAccountId(sender.id)
            const sendFundsStore = useSendFundsStore.getState()
            sendFundsStore.reset()
            sendFundsStore.setDestination(address)
            // The native asset pins the send to the network the user picked;
            // the account's own chain may be another network of the family.
            const native = findNativeAsset(chainId)
            if (native) {
                sendFundsStore.setSelectedAsset({
                    chainId,
                    assetId: native.assetId,
                })
            }
            void requestByType('send-funds', {}, SEND_SHEET_OPTIONS)
        },
        [requestByType],
    )

    const sendTo = async (family: ChainFamily, address: string) => {
        const chainIds = sendableChains(family)
        const chainId =
            chainIds.length > 1
                ? await request<ChainId>({
                      contents: (
                          <ContactSendNetworkContent chainIds={chainIds} />
                      ),
                      options: {
                          size: 'auto',
                          enablePanDownToClose: true,
                          autoCreateContainer: false,
                      },
                  })
                : chainIds[0]
        if (!chainId) return
        const resolution = resolveSender(chainId)
        if (resolution.kind === 'none') return
        const sender =
            resolution.kind === 'picker'
                ? await pickSender(chainId, resolution.accounts)
                : resolution.account
        if (sender) openSend(sender, chainId, address)
    }

    return { canSendOn, sendTo }
}
