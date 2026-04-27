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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import { getInboxQueryKey } from './querykeys'
import { useDeleteMultisigInvitationMutation } from './useDeleteMultisigInvitationMutation'

export const useCleanupDuplicateMultisigInvitations = (): void => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network) ?? ''
    const signingAccounts = useSigningAccounts()
    const allAccounts = useAllAccounts()

    const addresses = useMemo(
        () => signingAccounts.map(a => a.address),
        [signingAccounts],
    )
    const localAddresses = useMemo(
        () => new Set(allAccounts.map(a => a.address)),
        [allAccounts],
    )

    const { data: duplicateAddresses } = useQuery({
        queryKey: getInboxQueryKey(network, deviceID, addresses),
        queryFn: () => fetchInbox(network, deviceID, addresses),
        enabled: !!deviceID.length && !!addresses.length,
        select: useCallback(
            (data: InboxResponse) =>
                data.joint_account_import_requests
                    .map(req => req.address)
                    .filter(address => localAddresses.has(address)),
            [localAddresses],
        ),
    })

    const deleteMultisigInvitationMutation =
        useDeleteMultisigInvitationMutation({ network, deviceId: deviceID })

    const attemptedRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!deviceID || !duplicateAddresses?.length) return

        for (const address of duplicateAddresses) {
            if (attemptedRef.current.has(address)) continue
            attemptedRef.current.add(address)
            deleteMultisigInvitationMutation.mutate({
                multisigAddress: address,
            })
        }
    }, [deviceID, duplicateAddresses, deleteMultisigInvitationMutation])
}
