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

import type { ASAInbox } from '@perawallet/wallet-core-messages'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { StackScreenProps } from '@react-navigation/stack'

export type MultisigInvitationParam = {
    customId: string
    createdAt: string
    address: string
    version: number
    threshold: number
    participantAddresses: string[]
}

export type MessagesStackParamList = {
    MessagesHome: Optional<{ initialTab?: 'Inbox' | 'Notifications' }>
    AssetTransferRequests: {
        item: ASAInbox
    }
    AssetClaimDetail: { assetIndex: number }
    ClaimProcessing: {
        mode: 'claimArc59' | 'rejectArc59'
        assetIndex: number
        shouldClaimAlgo: boolean
    }
    ClaimSuccess: {
        transactionId: string
        variant?: 'claim' | 'reject'
    }
    MultisigInvitationName: { invitation: MultisigInvitationParam }
}

export type MessagesStackScreenProps<T extends keyof MessagesStackParamList> =
    StackScreenProps<MessagesStackParamList, T>
