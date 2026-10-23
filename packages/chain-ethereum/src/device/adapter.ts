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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { DeviceChainAdapter } from '@perawallet/wallet-core-device'
import { SeedScheme } from '@perawallet/wallet-core-kms/constants'
import type { EvmChain } from '../chains/types'

/**
 * The only `account_type` values the v4 devices API accepts on an `eip155`
 * item; any other value 422s the whole registration. It has no type for a
 * raw private-key account, so such an account isn't registered on EVM chains.
 */
export const EVM_DEVICE_ACCOUNT_TYPES = {
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    watch: 'watch',
} as const

const evmDeviceAccountType = ({ custody }: WalletAccount): string | null => {
    if (custody.kind === 'hardware') return EVM_DEVICE_ACCOUNT_TYPES.hardware
    if (custody.kind === 'watch') return EVM_DEVICE_ACCOUNT_TYPES.watch
    if (custody.kind === 'local' && custody.seed === SeedScheme.Bip39) {
        return EVM_DEVICE_ACCOUNT_TYPES.hdWallet
    }
    return null
}

// Rank 0 for every kind: the accounts store doesn't rank EVM duplicates either.
export const createEvmDeviceAdapter = (
    chain: EvmChain,
): DeviceChainAdapter => ({
    chainId: chain.descriptor.id,
    accountTypeOf: (account: WalletAccount) => evmDeviceAccountType(account),
    rankOf: () => 0,
})
