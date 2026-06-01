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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    isMultisigAccount,
    useUpdateAccount,
} from '@perawallet/wallet-core-accounts'
import { useMultisigAccountDetailQuery } from '@perawallet/wallet-core-multisig'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

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
