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

import { Networks, type Network } from '@perawallet/wallet-core-shared'

/**
 * i18n keys for each network's display name. Static strings: pnpm lint:i18n
 * cannot verify an interpolated key, so no `common.network_label.${network}`.
 */
export const NETWORK_LABEL_KEYS: Record<Network, string> = {
    [Networks.mainnet]: 'common.network_label.mainnet',
    [Networks.testnet]: 'common.network_label.testnet',
    [Networks.betanet]: 'common.network_label.betanet',
    [Networks.fnet]: 'common.network_label.fnet',
    [Networks.localnet]: 'common.network_label.localnet',
}
