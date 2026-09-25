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
import {
    getNetworkConfig,
    isMainnet as isMainnetHelper,
    isTestnet as isTestnetHelper,
} from '@perawallet/wallet-core-config'
import { useCustomNetworkStore, useNetworkStore } from '../store'

export const useNetwork = () => {
    const network = useNetworkStore(state => state.network)
    const setNetwork = useNetworkStore(state => state.setNetwork)
    const customNetwork = useCustomNetworkStore(state => state.customNetwork)

    const isMainnet = isMainnetHelper(network)
    const isTestnet = isTestnetHelper(network)
    // customNetwork is a real dependency: getNetworkConfig reads the saved
    // node for `custom`, so a saved change must produce a fresh config.
    const networkConfig = useMemo(
        () => getNetworkConfig(network),
        [network, customNetwork],
    )

    return { network, setNetwork, isMainnet, isTestnet, networkConfig }
}
