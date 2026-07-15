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
    mapMultiSigAccount,
    mapSignRequest,
} from '@perawallet/wallet-core-multisig'
import type { ASAInboxResponse, InboxResponse } from '../api/inbox'
import type { ASAInbox, InboxItem } from '../models'

export {
    mapMultiSigAccount,
    mapTransactionList,
    mapSignRequest,
} from '@perawallet/wallet-core-multisig'

export const mapASAInbox = (response: ASAInboxResponse): ASAInbox => ({
    address: response.address,
    inboxAddress: response.inbox_address,
    requestCount: response.request_count,
})

export const mapInboxResponse = (response: InboxResponse): InboxItem[] => {
    const items: InboxItem[] = []

    for (const importReq of response.joint_account_import_requests) {
        const data = mapMultiSigAccount(importReq)
        items.push({
            type: 'multisig_import',
            data,
            createdAt: data.createdAt,
        })
    }

    for (const signReq of response.joint_account_sign_requests) {
        const data = mapSignRequest(signReq)
        items.push({
            type: 'multisig_sign',
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
    return items
}
