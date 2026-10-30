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

import { useEffect } from 'react'
import { create } from 'zustand'
import { registerStore } from '@perawallet/wallet-core-shared'

type ScannerRequestState = {
    isRequested: boolean
    /** QR scanners currently open anywhere in the app. */
    openScannerCount: number
}

type ScannerRequestActions = {
    requestScanner: () => void
}

type ScannerRequestStore = ScannerRequestState & ScannerRequestActions

/**
 * Asks the home screen to open its QR scanner from outside it (the scan
 * deep link, Control Center, the app icon's quick action). A flag rather than
 * an event: the request may arrive before the home screen has mounted.
 */
export const useScannerRequestStore = create<ScannerRequestStore>()(set => ({
    isRequested: false,
    openScannerCount: 0,
    requestScanner: () => set({ isRequested: true }),
}))

registerStore({
    name: 'scanner-request-store',
    clearStorage: () => {},
    resetState: () =>
        useScannerRequestStore.setState({
            isRequested: false,
            openScannerCount: 0,
        }),
})

/** Opens the scanner for each pending request, including one made before mount. */
export const useScannerRequest = (open: () => void): void => {
    const isRequested = useScannerRequestStore(state => state.isRequested)

    useEffect(() => {
        if (!isRequested) return
        useScannerRequestStore.setState({ isRequested: false })
        open()
    }, [isRequested, open])
}

/**
 * Counts a scanner while `isOpen`, so a scan request can be ignored when one is
 * already showing: acting on it would navigate, dismiss that scanner and open
 * another.
 */
export const useTrackOpenScanner = (isOpen: boolean): void => {
    useEffect(() => {
        if (!isOpen) return
        useScannerRequestStore.setState(state => ({
            openScannerCount: state.openScannerCount + 1,
        }))
        return () =>
            useScannerRequestStore.setState(state => ({
                openScannerCount: state.openScannerCount - 1,
            }))
    }, [isOpen])
}
