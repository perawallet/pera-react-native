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
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'
import { cardAdapterFor } from '../chain-adapter'

/** True once a real Killswitch app is configured for the network. */
export const isKillswitchConfigured = (network: Network): boolean =>
    cardAdapterFor(network).autoDraw.isConfigured(network)

export type UseKillswitchAutoDrawResult = {
    /** Built for fee delegation: the sponsor pays the group's fees. */
    buildEnable: (params: {
        sender: string
        cardAddress: string
        asset: string
    }) => Promise<PeraTransaction[]>
    buildKill: (params: {
        sender: string
        asset: string
    }) => Promise<PeraTransaction[]>
    /**
     * Callers MUST check this before enable/kill rather than parse reverts,
     * which surface as opaque simulate failures. An unknown state rethrows
     * instead of reading as disabled.
     */
    isAutoDrawEnabled: (params: {
        sender: string
        asset: string
    }) => Promise<boolean>
}

export const useKillswitchAutoDraw = (): UseKillswitchAutoDrawResult => {
    const { network } = useNetwork()

    return useMemo(() => {
        const autoDraw = () => cardAdapterFor(network).autoDraw
        return {
            buildEnable: params =>
                autoDraw().buildEnable({ ...params, network }),
            buildKill: params => autoDraw().buildKill({ ...params, network }),
            isAutoDrawEnabled: params =>
                autoDraw().isEnabled({ ...params, network }),
        }
    }, [network])
}
