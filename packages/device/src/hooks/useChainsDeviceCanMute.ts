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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { canMuteChainInDeviceRegistration } from './endpoints'

/**
 * Registered chains, in registry order, whose pushes this device can mute on
 * the current deployment. Reads the v4 gate through the remote-config store so
 * a flip re-renders, and keeps its identity until the set changes.
 */
export const useChainsDeviceCanMute = (): ChainId[] => {
    const deployment = useWalletDeployment()
    const key = useRemoteConfigStore(() =>
        getProvider()
            .chains.list()
            .map(({ id }) => id)
            .filter(chainId =>
                canMuteChainInDeviceRegistration(chainId, deployment),
            )
            .join(),
    )
    return useMemo(() => (key ? (key.split(',') as ChainId[]) : []), [key])
}
