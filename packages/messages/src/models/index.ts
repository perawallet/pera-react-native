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

import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export type NotificationsState = BaseStoreState & {
    notificationDisabledAccounts: string[]
    setAccountNotificationEnabled: (address: string, enabled: boolean) => void
    isAccountNotificationEnabled: (address: string) => boolean
}

export type NotificationStatus = {
    hasNewNotification: boolean
}

export type NotificationIcon = {
    logo: string
    shape: 'circle' | 'rectangle'
}

export type PeraNotification = {
    id: string
    accountAddress: string
    message: string
    url: string
    createdAt: Date
    isUnread?: boolean
    icon?: NotificationIcon | null
}

export interface MultiSigAccount {
    customId: string
    createdAt: Date
    address: string
    version: number
    threshold: number
    participantAddresses: string[]
}

export type SignRequestStatus =
    | 'pending'
    | 'ready'
    | 'submitting'
    | 'confirmed'
    | 'failed'
    | 'expired'
    | 'declined'

export interface SignerResponse {
    address: string
    response: 'signed' | 'declined'
}

export interface TransactionList {
    id: string
    rawTransactions: string[]
    firstValidBlock: number
    lastValidBlock: number
    expectedExpireDatetime: Date
    responses: SignerResponse[]
}

export interface JointAccountSignRequest {
    id: string
    status: SignRequestStatus
    type: string
    createdAt: Date
    expectedExpireDatetime: Date
    failReasonDisplay: string | null
    jointAccount: MultiSigAccount
    transactionLists: TransactionList[]
}

export interface ASAInbox {
    address: string
    inboxAddress: string | null
    requestCount: number
}

export type InboxItem =
    | { type: 'joint_account_import'; data: MultiSigAccount; createdAt: Date }
    | {
          type: 'joint_account_sign'
          data: JointAccountSignRequest
          createdAt: Date
      }
    | { type: 'asa_inbox'; data: ASAInbox; createdAt: Date }
