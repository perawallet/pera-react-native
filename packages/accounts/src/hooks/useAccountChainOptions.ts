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

import { useCallback } from 'react'
import type {
    ChainCapability,
    ChainFamily,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import { eligibleChainsInFamily } from '../credentials/eligibility'
import type { WalletAccount } from '../models'

export type AccountChainOption = {
    chainId: ChainId
    /** False for a chain the account is eligible for but has no entry on yet. */
    isEnabled: boolean
    /**
     * The account's address on the chain. For a chain not enabled yet it is
     * the address the account holds in the same family, since every chain in
     * a family derives the same one; unset when it holds none there.
     */
    address?: string
}

const addressByFamily = (account: WalletAccount): Map<ChainFamily, string> => {
    const byFamily = new Map<ChainFamily, string>()
    for (const { id, family } of getProvider().chains.list()) {
        const address = chainAccountOf(account, id)?.address
        if (address !== undefined && !byFamily.has(family)) {
            byFamily.set(family, address)
        }
    }
    return byFamily
}

/**
 * The chains a flow can use the account on: its enabled chains, then the ones
 * it could enable in a family it is already on, each in registry order and
 * limited to `isOn`. A hardware account offers only its enabled chains, since
 * a new one needs its device.
 */
export const accountChainOptions = (
    account: WalletAccount,
    isOn: (chainId: ChainId) => boolean,
): AccountChainOption[] => {
    const { chains } = getProvider()
    const familyAddress = addressByFamily(account)
    const options = eligibleChainsInFamily(account)
        .filter(isOn)
        .map(chainId => {
            const own = chainAccountOf(account, chainId)?.address
            return {
                chainId,
                isEnabled: own !== undefined,
                address:
                    own ??
                    familyAddress.get(chains.get(chainId).descriptor.family),
            }
        })
    const enabled = options.filter(option => option.isEnabled)
    if (account.custody.kind === 'hardware') return enabled
    return [...enabled, ...options.filter(option => !option.isEnabled)]
}

export const useAccountChainOptionsResolver = (
    capability: ChainCapability,
): ((account: WalletAccount) => AccountChainOption[]) => {
    const check = useChainCapabilityCheck()
    return useCallback(
        (account: WalletAccount) =>
            accountChainOptions(account, chainId =>
                check({ chain: { chainId, capability } }),
            ),
        [check, capability],
    )
}
