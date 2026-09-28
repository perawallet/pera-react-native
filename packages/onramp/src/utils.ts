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

import type { Network } from '@perawallet/wallet-core-shared'

import { rampAdapterFor } from './chain-adapter'
import type { RampHistoryItem, RampToken } from './models'

/** Whether any order in a ramp history slice still awaits user attention. */
export const hasPendingRampOrder = (items: RampHistoryItem[]): boolean =>
    items.some(item => item.status === 'pending')

/** Whether a ramp-catalogue token is the network's native coin. */
export const isNativeRampToken = (
    token: Pick<RampToken, 'id' | 'symbol'>,
    network: Network,
): boolean => rampAdapterFor(network).isNativeToken(token)

/** The on-chain asset id a ramp token arrives as on the network. */
export const rampTokenAssetId = (
    token: Pick<RampToken, 'id' | 'symbol'>,
    network: Network,
): string => rampAdapterFor(network).toAssetId(token)
