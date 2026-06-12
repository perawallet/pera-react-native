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

import { useEffect, useRef } from 'react'
import {
    generateMultisigAddress,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useMultisigAccountDetailQuery } from '@perawallet/wallet-core-multisig'
import { logger } from '@perawallet/wallet-core-shared'
import { isMultisigAccount } from '../utils'
import { useUpdateAccount } from './useUpdateAccount'

import type { WalletAccount } from '../models'

type UseMultisigDetailsBackfillResult = {
    isBackfilling: boolean
}

/**
 * Heals multisig accounts persisted before `multisigDetails` existed (records
 * carry only type/address/name). Pulls the participant set + threshold from the
 * joint-accounts endpoint and writes it back into the account store, since the
 * details can't be reconstructed from the address alone.
 */
export const useMultisigDetailsBackfill = (
    account: WalletAccount,
): UseMultisigDetailsBackfillResult => {
    const { network } = useNetwork()
    const updateAccount = useUpdateAccount()
    const backfilledAddresses = useRef<Set<string>>(new Set())

    const needsBackfill = isMultisigAccount(account) && !account.multisigDetails

    const { data, isFetching } = useMultisigAccountDetailQuery({
        network,
        address: account.address,
        enabled: needsBackfill,
    })

    useEffect(() => {
        if (!isMultisigAccount(account) || account.multisigDetails || !data) {
            return
        }
        if (backfilledAddresses.current.has(account.address)) return
        backfilledAddresses.current.add(account.address)

        // The address is the local source of truth; never persist a
        // server-provided cosigner set it doesn't commit to. A mismatch means
        // a wrong or malicious backend response — leave the account un-healed.
        let derivedAddress: string | null = null
        try {
            derivedAddress = generateMultisigAddress(
                data.version,
                data.threshold,
                data.participantAddresses,
            )
        } catch {
            // malformed participant address — treated as a mismatch below
        }
        if (derivedAddress !== account.address) {
            logger.warn(
                'Multisig backfill skipped: server participant set does not derive the account address',
                { address: account.address },
            )
            return
        }

        updateAccount({
            ...account,
            multisigDetails: {
                threshold: data.threshold,
                addresses: data.participantAddresses,
                version: data.version,
            },
        })
    }, [account, data, updateAccount])

    return { isBackfilling: needsBackfill && isFetching }
}
