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

import type { StackScreenProps } from '@react-navigation/stack'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

export type SendFundsStackParamList = {
    ChainSelection: undefined
    AssetSelection: undefined
    InputAmount: undefined
    SelectDestination: undefined
    ConfirmTransaction: undefined
    /** The contacts form, prefilled with the recipient on its chain. */
    AddContact: { address: string; chainId: ChainId }
    ExpressSend: undefined
    AssetInboxSendSummary: undefined
    InsufficientBalance: { requiredBalanceLabel: string }
    TransactionProcessing: undefined
    TransactionSuccess: {
        transactionId: string
        variant?: 'payment' | 'asset_transfer' | 'close_account'
    }
}

export type SendFundsStackScreenProps<T extends keyof SendFundsStackParamList> =
    StackScreenProps<SendFundsStackParamList, T>
