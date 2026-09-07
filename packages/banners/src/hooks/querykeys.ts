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
import type { Query } from '@tanstack/react-query'

export const BANNERS_MODULE_PREFIX = 'banners'

export const getBannersQueryKey = (network: Network, deviceID: string) => [
    BANNERS_MODULE_PREFIX,
    'list',
    { network, deviceID },
]

export const getSpotBannersQueryKey = (network: Network, deviceID: string) => [
    BANNERS_MODULE_PREFIX,
    'spot-list',
    { network, deviceID },
]

export const invalidateAllBannersPredicate = (query: Query) =>
    query.queryKey.at(0) === BANNERS_MODULE_PREFIX
