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

import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { backupChainAdapters } from '../../chain-adapter'
import { isChainAddressPayload, type AccountRecordEntry } from '../models'

/** Restoring an account needs the chain's accounts adapter, so a chain without one can't be read back. */
export const isBackupChain = (chainId: ChainId): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chainId) &&
        chains.capabilities(chainId).cloudBackup &&
        accountsChainAdapters.has(chainId)
    )
}

export const readableBackupChains = (): ChainId[] =>
    getProvider()
        .chains.list()
        .map(descriptor => descriptor.id)
        .filter(isBackupChain)
        .sort()

/** Whether this build restores a record's entry: a chain it backs up, and for
 *  a kind the chain's adapter owns, one that adapter decodes. Anything else
 *  stays in the record for a build that can. */
export const canRestoreRecordEntry = ({
    chain,
    payload,
}: AccountRecordEntry): boolean => {
    const chainId = chain as ChainId
    if (!isBackupChain(chainId)) return false
    if (!isChainAddressPayload(payload)) return true
    return (
        backupChainAdapters.has(chainId) &&
        backupChainAdapters.get(chainId).localKindOf(payload.type) !== undefined
    )
}
