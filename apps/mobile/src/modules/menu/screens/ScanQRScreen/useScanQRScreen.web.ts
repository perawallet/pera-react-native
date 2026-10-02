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

import { useCallback, useRef, useState } from 'react'
import {
    useFocusEffect,
    useNavigation,
    type NavigationProp,
} from '@react-navigation/native'
import { closeCurrentTab } from '@perawallet/wallet-core-browser-runtime'
import { navigationRef } from '@routes/navigationRef'
import type { RootStackParamList } from '@routes/types'

type UseScanQRScreenResult = {
    restartKey: number
    handleScanned: () => void
    handleClose: () => void
    handleRestart: () => void
}

export const useScanQRScreen = (): UseScanQRScreenResult => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>()
    // Remount key: re-arms the camera after a non-dispatchable decode,
    // mirroring QRScannerView.web's restart contract.
    const [restartKey, setRestartKey] = useState(0)
    const hasFocusedRef = useRef(false)

    const handleRestart = useCallback(() => {
        setRestartKey(key => key + 1)
    }, [])

    // The camera stops after its first decode, so a scan that navigated away
    // (e.g. into an account import the user then backed out of) would return
    // to a dead scanner. The first focus is the mount, which already starts it.
    useFocusEffect(
        useCallback(() => {
            if (hasFocusedRef.current) handleRestart()
            hasFocusedRef.current = true
        }, [handleRestart]),
    )

    // Deep-link side effects (sheets/navigation) commit in the same tick
    // the scanner's success callback fires; popping synchronously unmounts
    // this screen mid-commit and trips the shell error boundary. Defer the
    // pop a tick, and skip it if the dispatch already navigated away.
    const handleScanned = useCallback(() => {
        setTimeout(() => {
            if (navigationRef.getCurrentRoute()?.name !== 'ScanQR') return
            if (navigation.canGoBack()) navigation.goBack()
        }, 0)
    }, [navigation])

    const handleClose = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack()
            return
        }
        // Tab was opened purely to host the scanner (?flow=scan): close it.
        void closeCurrentTab()
    }, [navigation])

    return { restartKey, handleScanned, handleClose, handleRestart }
}
