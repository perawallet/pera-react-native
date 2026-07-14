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
import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { useAccountBalancesQuery } from '@perawallet/wallet-core-accounts'
import { useBidali } from '../../hooks/useBidali'
import { useBidaliClose } from '../../hooks/useBidaliClose'
import { useBidaliTransport } from '../../hooks/useBidaliTransport'
import type WebView from 'react-native-webview'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseBidaliWebViewScreenResult = {
    url: string
    bidaliProviderJS: string
    onClose: () => void
    handleMessage: (data: unknown) => void
    webviewRef: React.RefObject<Nullable<WebView>>
}

export const useBidaliWebViewScreen = (): UseBidaliWebViewScreenResult => {
    const { selectedAccount } = useBidali()
    const onClose = useBidaliClose()
    const { network } = useNetwork()

    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        !!selectedAccount,
    )

    const { providerJS, handleMessage, webviewRef } = useBidaliTransport(
        selectedAccount,
        accountBalances,
    )

    const url = useMemo(() => {
        const networkConfig = getNetworkConfig(network)
        return `${networkConfig.bidaliBaseUrl}?key=${networkConfig.bidaliApiKey}`
    }, [network])

    return {
        url,
        bidaliProviderJS: providerJS,
        onClose,
        handleMessage,
        webviewRef,
    }
}
