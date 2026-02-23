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

import { useCallback, useMemo } from 'react'
import {
    useDeviceID,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { useAllAccounts, WalletAccount } from '@perawallet/wallet-core-accounts'
import { useQuery } from '@tanstack/react-query'
import { fetchInbox, type InboxResponse } from '../api/inbox'
import type {
    InboxItem,
    MultiSigAccount,
    JointAccountSignRequest,
    TransactionList,
    ASAInbox,
} from '../models'
import { getInboxQueryKey } from './querykeys'
import type {
    MultiSigAccountResponse,
    SignRequestResponse,
    TransactionListResponse,
    ASAInboxResponse,
} from '../api/inbox'

const mapMultiSigAccount = (
    response: MultiSigAccountResponse,
): MultiSigAccount => ({
    customId: response.custom_id,
    createdAt: new Date(response.creation_datetime),
    address: response.address,
    version: response.version,
    threshold: response.threshold,
    participantAddresses: response.participant_addresses,
})

const mapTransactionList = (
    response: TransactionListResponse,
): TransactionList => ({
    id: response.id,
    rawTransactions: response.raw_transactions,
    firstValidBlock: response.first_valid_block,
    lastValidBlock: response.last_valid_block,
    expectedExpireDatetime: new Date(response.expected_expire_datetime),
    responses: response.responses,
})

const mapSignRequest = (
    response: SignRequestResponse,
): JointAccountSignRequest => ({
    id: response.id,
    status: response.status,
    type: response.type,
    createdAt: new Date(response.creation_datetime),
    expectedExpireDatetime: new Date(response.expected_expire_datetime),
    failReasonDisplay: response.fail_reason_display,
    jointAccount: mapMultiSigAccount(response.joint_account),
    transactionLists: response.transaction_lists.map(mapTransactionList),
})

const mapASAInbox = (response: ASAInboxResponse): ASAInbox => ({
    address: response.address,
    inboxAddress: response.inbox_address,
    requestCount: response.request_count,
})

const mapInboxResponse = (response: InboxResponse): InboxItem[] => {
    const items: InboxItem[] = []

    for (const importReq of response.joint_account_import_requests) {
        const data = mapMultiSigAccount(importReq)
        items.push({
            type: 'joint_account_import',
            data,
            createdAt: data.createdAt,
        })
    }

    for (const signReq of response.joint_account_sign_requests) {
        const data = mapSignRequest(signReq)
        items.push({
            type: 'joint_account_sign',
            data,
            createdAt: data.createdAt,
        })
    }

    for (const asaInbox of response.asa_inboxes) {
        items.push({
            type: 'asa_inbox',
            data: mapASAInbox(asaInbox),
            createdAt: new Date(0),
        })
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return items
}

export type UseInboxQueryResult = {
    inboxItems: InboxItem[]
    isPending: boolean
    isRefetching: boolean
    refetch: () => void
}

const SORT_ORDER = ['joint_account_import', 'joint_account_sign', 'asa_inbox']

const sortInboxItems = (
    a: InboxItem,
    b: InboxItem,
    accounts: WalletAccount[],
): number => {
    const aSortIndex = SORT_ORDER.indexOf(a.type)
    const bSortIndex = SORT_ORDER.indexOf(b.type)

    if (aSortIndex !== bSortIndex) {
        return aSortIndex - bSortIndex
    }

    if (aSortIndex === 2) {
        const aAccountIndex = accounts.findIndex(
            acc => acc.address === (a.data as ASAInbox).address,
        )
        const bAccountIndex = accounts.findIndex(
            acc => acc.address === (b.data as ASAInbox).address,
        )
        return aAccountIndex - bAccountIndex
    }
    if (a.createdAt > b.createdAt) return -1
    if (a.createdAt < b.createdAt) return 1
    return 0
}

export const useInboxQuery = (): UseInboxQueryResult => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const accounts = useAllAccounts()

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const query = useQuery({
        queryKey: getInboxQueryKey(network, deviceID!, addresses.length),
        queryFn: () => fetchInbox(network, deviceID ?? '', addresses),
        enabled: !!deviceID?.length && addresses.length > 0,
        select: useCallback(
            (data: InboxResponse) =>
                mapInboxResponse(data)
                    .filter(item => {
                        if (item.type === 'asa_inbox') {
                            return item.data.requestCount > 0
                        }
                        return true
                    })
                    .sort((a, b) => sortInboxItems(a, b, accounts)),
            [accounts],
        ),
    })

    return {
        inboxItems: query.data ?? [],
        isPending: query.isPending,
        isRefetching: query.isRefetching,
        refetch: query.refetch,
    }
}
