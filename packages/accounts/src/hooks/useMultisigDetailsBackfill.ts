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

import { useEffect, useRef } from 'react'
import {
    legacyNetworkOf,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    multisigChainAdapters,
    useMultisigAccountDetailQuery,
} from '@perawallet/wallet-core-multisig'
import { logger } from '@perawallet/wallet-core-shared'
import { addressOn, hasCustody } from '../credentials'
import { multisigParametersOf, withMultisigParameters } from '../multisig'
import { useUpdateAccount } from './useUpdateAccount'

import type { WalletAccount } from '../models'

type UseMultisigDetailsBackfillResult = {
    isBackfilling: boolean
}

/**
 * Heals multisig accounts persisted before their parameters were stored
 * (records carry only custody, address and name). Pulls the participant set
 * and threshold from the joint-accounts endpoint and writes them back into
 * the account store, since they can't be reconstructed from the address
 * alone. Inert on a chain without the `multisig` capability.
 */
export const useMultisigDetailsBackfill = (
    account: WalletAccount,
    scope: ChainScope,
): UseMultisigDetailsBackfillResult => {
    const updateAccount = useUpdateAccount()
    const backfilledAddresses = useRef<Set<string>>(new Set())
    const isMultisigEnabled = useChainCapability(scope.chainId, 'multisig')
    const address = addressOn(account, scope)

    const needsBackfill =
        isMultisigEnabled &&
        address !== undefined &&
        multisigChainAdapters.has(scope.chainId) &&
        hasCustody(account, 'multisig') &&
        !multisigParametersOf(account, scope.chainId)

    const { data, isFetching } = useMultisigAccountDetailQuery({
        network: legacyNetworkOf(scope),
        address: address ?? '',
        enabled: needsBackfill,
    })

    useEffect(() => {
        if (!needsBackfill || !data || address === undefined) return
        if (backfilledAddresses.current.has(address)) return
        backfilledAddresses.current.add(address)

        const parameters = {
            version: data.version,
            threshold: data.threshold,
            addresses: data.participantAddresses,
        }
        // The address is the local source of truth; never persist a
        // server-provided cosigner set it doesn't commit to. A mismatch means
        // a wrong or malicious backend response — leave the account un-healed.
        let derivedAddress: string | null = null
        try {
            derivedAddress = multisigChainAdapters
                .get(scope.chainId)
                .deriveAddress(parameters)
        } catch {
            // A malformed participant address leaves the account un-healed below.
        }
        if (derivedAddress !== address) {
            logger.warn(
                'Multisig backfill skipped: server participant set does not derive the account address',
                { address },
            )
            return
        }

        updateAccount(
            withMultisigParameters(account, scope.chainId, parameters),
        )
    }, [account, address, data, needsBackfill, scope.chainId, updateAccount])

    return { isBackfilling: needsBackfill && isFetching }
}
