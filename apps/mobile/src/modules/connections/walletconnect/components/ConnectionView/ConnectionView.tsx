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

import {
    AlgorandChainId,
    AlgorandPermission,
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import {
    ConnectionApprovalSheet,
    type ConnectionNetwork,
} from '@modules/connections/components/ConnectionApprovalSheet'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'

export type ConnectionViewProps = {
    request: WalletConnectSessionRequest
    onSuccess: (request: WalletConnectSessionRequest) => void
    onError: (error?: Error) => void
}

const networksForChainId = (chainId: number): ConnectionNetwork[] => {
    if (chainId === AlgorandChainId.all) return ['mainnet', 'testnet']
    return chainId === AlgorandChainId.testnet ? ['testnet'] : ['mainnet']
}

//TODO implement project validation using our backend to show a "verified" badge somewhere
export const ConnectionView = ({
    request,
    onSuccess,
    onError,
}: ConnectionViewProps) => {
    const { t } = useLanguage()
    const { removeSessionRequest } = useWalletConnectSessionRequests()
    const { network } = useNetwork()
    const { approveSession, rejectSession } = useWalletConnect(network)
    const { pushWebView } = useWebView()

    const preferredIcon =
        request.peerMeta.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? request.peerMeta.icons?.at(0)

    const handleCancel = () => {
        rejectSession(request.clientId)
        removeSessionRequest(request)
    }

    const handleConnect = (selectedAccounts: string[]) => {
        try {
            approveSession(request.clientId, request, selectedAccounts)
            onSuccess(request)
            removeSessionRequest(request)
        } catch (error) {
            onError(error as Error)
        }
    }

    const handlePressUrl = request.peerMeta.url
        ? () =>
              pushWebView({
                  id: generateOrderedUniqueId(),
                  url: request.peerMeta.url as string,
              })
        : undefined

    return (
        <ConnectionApprovalSheet
            networks={networksForChainId(request.chainId)}
            iconUri={preferredIcon}
            fallbackIconName='wallet-connect'
            title={t('walletconnect.request.title', {
                name: request.peerMeta.name,
            })}
            subtitle={request.peerMeta.url}
            onSubtitlePress={handlePressUrl}
            permissions={request.permissions as AlgorandPermission[]}
            accountsTitle={t('walletconnect.request.accounts_title')}
            onApprove={handleConnect}
            onReject={handleCancel}
        />
    )
}
