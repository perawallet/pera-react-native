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

import * as SplashScreen from 'expo-splash-screen'
import { initDecimalConfig } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { initNetworkStatus } from '@modules/network'
import { registerAppBottomSheets } from './bottom-sheet-registrations'
import { registerLocaleTour } from '@modules/locale-tour/register'
import { registerHardwareWalletTransports } from './hardware-wallet-transports'
import { registerChainAdapters } from './chain-adapters'

/**
 * Process-wide setup that has to land before the React tree mounts. Called by
 * entry.native.js once every module has evaluated and before
 * registerRootComponent, so nothing here may depend on a mounted component.
 */
export const initRuntime = (): void => {
    // Deep links and other non-React callers can request sheets by key from the
    // first frame.
    registerAppBottomSheets()
    // Resolves to a no-op stub in every non-dev bundle (see metro.config.js).
    registerLocaleTour()
    registerHardwareWalletTransports(getProvider().hardwareWalletRegistry)
    registerChainAdapters()
    // Seeds onlineManager before QueryProvider mounts, so early queries never
    // fire-and-fail against a dead link.
    void initNetworkStatus()
    initDecimalConfig()
    // useAppBootstrap hides it once the first layout after bootstrap lands.
    void SplashScreen.preventAutoHideAsync()
}
