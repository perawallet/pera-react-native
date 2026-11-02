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
import { Linking } from 'react-native'
import { useCapability } from '@hooks/useCapability'
import { useModalState } from '@hooks/useModalState'
import { trackEvent, MenuEvent, FundEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { routeCapabilities } from '@routes/capabilities'
import { ReceiveFundsContent } from '@modules/transactions/routes'
import { BIDALI_SHEET_OPTIONS } from '@modules/gift-card'
import { BidaliContent } from '@modules/gift-card/routes'
import { PasteLinkContent } from '@modules/menu/components/PasteLinkContent'

type UseMenuScreenResult = {
    canStake: boolean
    isScannerVisible: boolean
    openScanner: () => void
    closeScanner: () => void
    openReceiveFunds: () => void
    openBidali: () => void
    openPasteLink: () => void
    openHelpCenter: () => void
}

export const useMenuScreen = (): UseMenuScreenResult => {
    const scanner = useModalState()
    const canStake = useCapability({
        platform: 'staking',
        anyChain: 'staking',
    })
    const { open } = scanner
    const { request: requestBottomSheet } = useBottomSheet()
    const { pushWebView } = useWebView()

    const openScanner = useCallback(() => {
        trackEvent(MenuEvent.QrScan)
        open()
    }, [open])

    const openReceiveFunds = useCallback(() => {
        trackEvent(MenuEvent.Receive)
        void requestBottomSheet({
            contents: <ReceiveFundsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openBidali = useCallback(() => {
        trackEvent(FundEvent.BidaliSelected)
        void requestBottomSheet({
            contents: <BidaliContent />,
            options: BIDALI_SHEET_OPTIONS,
        })
    }, [requestBottomSheet])

    const openPasteLink = useCallback(() => {
        trackEvent(MenuEvent.PasteLink)
        void requestBottomSheet({
            contents: <PasteLinkContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openHelpCenter = useCallback(() => {
        if (!routeCapabilities.inAppWebView) {
            // react-native-web maps Linking.openURL to window.open (new tab).
            void Linking.openURL(config.supportBaseUrl)
            return
        }
        pushWebView({
            url: config.supportBaseUrl,
            id: 'help-center',
        })
    }, [pushWebView])

    return {
        canStake,
        isScannerVisible: scanner.isOpen,
        openScanner,
        closeScanner: scanner.close,
        openReceiveFunds,
        openBidali,
        openPasteLink,
        openHelpCenter,
    }
}
