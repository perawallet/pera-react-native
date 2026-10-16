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
import type { ConfirmNetworkSwitch } from '@perawallet/wallet-core-connections'
import {
    chainDisplayNameOf,
    getChainDescriptor,
} from '@perawallet/wallet-core-chain-shared'
import { generateUniqueId } from '@perawallet/wallet-core-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { getPreferredDappIcon } from '@modules/walletconnect'
import { toPeerDisplayText } from '@utils/peerDisplay'

/** The sheet a dApp's network switch waits on. `dismiss` closes it without an answer. */
export const useNetworkSwitchPrompt = (): ConfirmNetworkSwitch => {
    const { t } = useLanguage()
    const { request, dismiss } = useBottomSheet()

    return useCallback(
        ({ scope, peer }) => {
            const id = generateUniqueId()
            const network = getChainDescriptor(scope.chainId).networks.find(
                ({ id: networkId }) => networkId === scope.networkId,
            )
            const decision = request<boolean>({
                id,
                contents: (
                    <ConfirmActionContent
                        icon='globe'
                        iconUrl={getPreferredDappIcon(peer.icons)}
                        title={t('walletconnect.switch_network.title')}
                        message={t('walletconnect.switch_network.body', {
                            name: toPeerDisplayText(peer.name),
                            chain: chainDisplayNameOf(scope.chainId),
                            network: network?.displayName ?? scope.networkId,
                        })}
                        confirmLabel={t('walletconnect.switch_network.confirm')}
                        cancelLabel={t('common.cancel.label')}
                    />
                ),
                options: {
                    size: 'auto',
                    // Cancel rejects the dApp, so the sheet offers no third exit.
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                },
            }).then(result => result === true)
            return { decision, dismiss: () => dismiss(id) }
        },
        [t, request, dismiss],
    )
}
