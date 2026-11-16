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

import { useMemo } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    isEvmChainId,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useConnectionsStore } from '@perawallet/wallet-core-connections'
import { EIP1193_DAPP_KIND } from '@perawallet/wallet-core-dapp'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    useChangeConnectionAccount,
    type ChangeableConnection,
} from '@modules/walletconnect'

export type UseWebViewAccountChipResult = {
    /** The account the site uses; `null` once it left the wallet. */
    account: Nullable<WalletAccount>
    chainId: Optional<ChainId>
    isVisible: boolean
    isChanging: boolean
    handlePress: () => Promise<void>
}

// An opaque origin (about:, data:, blob:) is no site a connection is keyed by.
const originOf = (url: string): Nullable<string> => {
    try {
        const { origin } = new URL(url)
        return origin === 'null' ? null : origin
    } catch {
        return null
    }
}

const NO_CONNECTION: ChangeableConnection = {
    id: '',
    accounts: [],
    evmChainIds: [],
}

export const useWebViewAccountChip = (
    url: string,
): UseWebViewAccountChipResult => {
    const connections = useConnectionsStore(state => state.connections)
    const origin = originOf(url)
    const connection = useMemo(
        () =>
            origin === null
                ? undefined
                : connections.find(
                      candidate =>
                          candidate.kind === EIP1193_DAPP_KIND &&
                          candidate.origin?.requesterOrigin === origin,
                  ),
        [connections, origin],
    )
    const rawChainId = connection?.metadata?.chainId
    const changeable = useMemo(
        () =>
            connection && isEvmChainId(rawChainId)
                ? {
                      id: connection.id,
                      accounts: connection.accounts,
                      evmChainIds: [rawChainId],
                  }
                : NO_CONNECTION,
        [connection, rawChainId],
    )
    const {
        evmChainId,
        activeEvmAccount,
        isAvailable,
        isChanging,
        handleChangeAccount,
    } = useChangeConnectionAccount(changeable)

    return {
        account: activeEvmAccount,
        chainId: evmChainId,
        isVisible: isAvailable,
        isChanging,
        handlePress: handleChangeAccount,
    }
}
