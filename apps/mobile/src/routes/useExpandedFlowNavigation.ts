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

import { useCallback } from 'react'
import { consumeInitialExpandedFlow } from '@perawallet/wallet-extension-platform-chrome'

export type ExpandedFlowScreen = 'AddAccount' | 'BackupWallet' | 'ScanQR'

/**
 * Parses the one-shot `?flow=` deep-link param the popup passed to
 * expanded.html and dispatches the matching navigate call. Returns a stable
 * callback meant to be used as the root NavigationContainer's `onReady`.
 */
export const useExpandedFlowNavigation = (
    navigate: (screen: ExpandedFlowScreen) => void,
): (() => void) =>
    useCallback((): void => {
        const flow = consumeInitialExpandedFlow()
        if (flow === 'add-account') {
            navigate('AddAccount')
        } else if (flow === 'backup-wallet') {
            navigate('BackupWallet')
        } else if (flow === 'scan') {
            navigate('ScanQR')
        }
    }, [navigate])
