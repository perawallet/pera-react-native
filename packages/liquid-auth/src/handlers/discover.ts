/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Arc0027Handler } from '../arc0027/dispatcher'
import type { Arc0027Method } from '../arc0027/types'
import type { LiquidAuthNetwork } from '../models'

const SUPPORTED_METHODS: Arc0027Method[] = [
    'enable',
    'disable',
    'sign_transactions',
    'post_transactions',
    'sign_and_post_transactions',
    'sign_message',
]

export type DiscoverConfig = {
    providerId: string
    name: string
    icon?: string
    networks: LiquidAuthNetwork[]
}

export const createDiscoverHandler =
    (config: DiscoverConfig): Arc0027Handler =>
    async () => ({
        providerId: config.providerId,
        name: config.name,
        icon: config.icon,
        networks: config.networks.map(network => ({
            ...network,
            methods: SUPPORTED_METHODS,
        })),
    })
