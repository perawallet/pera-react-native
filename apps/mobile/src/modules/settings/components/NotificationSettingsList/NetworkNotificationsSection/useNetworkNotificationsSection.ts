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

import { useCallback, useMemo } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    useChainsDeviceCanMute,
    useDeviceStore,
} from '@perawallet/wallet-core-device'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useNetworkNotificationToggle } from '@modules/settings/hooks/useNetworkNotificationToggle'

export type NetworkNotificationOption = {
    chainId: ChainId
    displayName: string
}

export type UseNetworkNotificationsSectionResult = {
    networks: NetworkNotificationOption[]
    isNetworkEnabled: (chainId: ChainId) => boolean
    isNetworkPending: (chainId: ChainId) => boolean
    handleNetworkToggle: (chainId: ChainId, enabled: boolean) => void
}

export const useNetworkNotificationsSection =
    (): UseNetworkNotificationsSectionResult => {
        const mutableChainIds = useChainsDeviceCanMute()
        const mutedChainIds = useDeviceStore(state => state.mutedChainIds)
        const { toggleNetworkNotification, isTogglePending } =
            useNetworkNotificationToggle()
        // A chain mute only skips pushes, so there is nothing to offer where
        // the platform can't receive them.
        const isPushSupported = getProvider().pushNotification.isSupported()

        const networks = useMemo(
            () =>
                isPushSupported
                    ? mutableChainIds.map(chainId => ({
                          chainId,
                          displayName:
                              getProvider().chains.get(chainId).descriptor
                                  .displayName,
                      }))
                    : [],
            [isPushSupported, mutableChainIds],
        )

        const isNetworkEnabled = useCallback(
            (chainId: ChainId) => !mutedChainIds.includes(chainId),
            [mutedChainIds],
        )

        const handleNetworkToggle = useCallback(
            (chainId: ChainId, enabled: boolean) => {
                void toggleNetworkNotification(chainId, enabled)
            },
            [toggleNetworkNotification],
        )

        return {
            networks,
            isNetworkEnabled,
            isNetworkPending: isTogglePending,
            handleNetworkToggle,
        }
    }
