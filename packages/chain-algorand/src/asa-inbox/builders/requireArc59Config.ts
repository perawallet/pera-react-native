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

import { getArc59Config } from '@perawallet/wallet-core-config'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { algorandScope, type AlgorandNetworkId } from '../../network-id'

/**
 * The network's ARC-59 inbox config, or throw if the inbox app is not deployed
 * there.
 *
 * Exists so the three build sites get a non-null config without each repeating
 * the guard: `getArc59Config` is nullable by design, but every caller that has
 * reached the point of building a transaction group needs a real app id and
 * cannot proceed without one.
 */
export const requireArc59Config = (
    network: AlgorandNetworkId,
): { appId: bigint; appAddress: string } => {
    const scope = algorandScope(network)
    const arc59Config = getArc59Config(scope)
    if (arc59Config === null) throw new PeraServiceUnavailableError(scope)

    return arc59Config
}
