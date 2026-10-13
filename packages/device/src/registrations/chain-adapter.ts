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

import {
    createChainAdapterRegistry,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'

/**
 * The part of a held account registration reads. Structural because the
 * accounts package depends on this one, so its account model can't be named
 * here.
 */
export type DeviceRegistrableAccount = {
    readonly chains: Readonly<
        Partial<Record<ChainId, { readonly address: string }>>
    >
}

/**
 * How a chain's accounts register with the devices API. A chain registers one
 * only if the backend should hear about its accounts; membership alone decides
 * that, whatever the chain's runtime capabilities.
 *
 * The members are methods, not function properties, so a chain can type
 * `account` as its full account model: registration hands back the accounts
 * its caller passed in.
 */
export interface DeviceChainAdapter {
    readonly chainId: ChainId
    /** The devices API `account_type`; `null` for an account the chain doesn't register. */
    accountTypeOf(account: DeviceRegistrableAccount): string | null
    /** Which of two registrations of one address the backend is told about: higher wins. */
    rankOf(account: DeviceRegistrableAccount): number
}

export const deviceChainAdapters =
    createChainAdapterRegistry<DeviceChainAdapter>('device')
