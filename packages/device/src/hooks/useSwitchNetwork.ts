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
import { useNetwork, useNetworkStore } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'

type UseSwitchNetworkResult = {
    switchNetwork: (newNetwork: Network) => Promise<void>
}

export const useSwitchNetwork = (): UseSwitchNetworkResult => {
    const { network } = useNetwork()
    const setNetwork = useNetworkStore(state => state.setNetwork)

    const switchNetwork = useCallback(
        async (newNetwork: Network) => {
            if (newNetwork === network) {
                return
            }

            // Switching networks is a purely local concern — flip the store
            // immediately so the switch works offline. Device registration
            // for the new network is owned by useDeviceRegistration: its
            // [addresses, network] effect re-fires on this write
            // (create-or-update with the 404 re-register fallback), marks the
            // network pending on failure, and heals on reconnect/foreground;
            // its useOnNetworkSwitch also clears the previous
            // network's push token. An unreachable backend must never block
            // or revert the switch; push notifications may lag until that
            // deferred registration lands. Callers kick the sync
            // (invalidate + restart) after switching.
            setNetwork(newNetwork)
        },
        [network, setNetwork],
    )

    return { switchNetwork }
}
