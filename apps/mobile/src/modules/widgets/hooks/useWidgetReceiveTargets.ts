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
    useAllAccounts,
    useCapabilityChainResolver,
} from '@perawallet/wallet-core-accounts'
import {
    getChainDescriptor,
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { receiveTargetOf } from '@utils/receiveTarget'
import type { WidgetReceiveTarget } from '../snapshot'

/** Every account that can receive, as the Receive screen would show its QR. */
export const useWidgetReceiveTargets = (): WidgetReceiveTarget[] => {
    const accounts = useAllAccounts()
    const chainOf = useCapabilityChainResolver('receive')
    const networks = useNetworkStore(state => state)

    return useMemo(
        () =>
            accounts.flatMap(account => {
                const chainId = chainOf(account)
                const scope =
                    chainId === undefined
                        ? null
                        : {
                              chainId,
                              networkId: selectChainNetworkId(
                                  networks,
                                  chainId,
                              ),
                          }
                const target = receiveTargetOf(account, scope)
                if (!target || !scope) return []
                return [
                    {
                        address: target.address,
                        name: target.accountName,
                        paymentUri: target.paymentUri,
                        // Absent on a custom network until its node is probed.
                        chain:
                            getChainDescriptor(scope.chainId).networks.find(
                                network => network.id === scope.networkId,
                            )?.caip2 ?? null,
                    },
                ]
            }),
        [accounts, chainOf, networks],
    )
}
