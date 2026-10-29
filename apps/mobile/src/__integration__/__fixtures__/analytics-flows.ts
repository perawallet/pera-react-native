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

import { expect } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    AnalyticsMetadataKey as Key,
    AnalyticsScreenName,
    OnboardingEvent,
    TransactionsEvent,
    WalletConnectEvent,
} from '@analytics'
import type {
    AnalyticsRecorder,
    RecordedAnalyticsEvent,
} from '@test-utils/analytics-recorder'

export type AnalyticsFlow =
    | 'send'
    | 'sendFailed'
    | 'receive'
    | 'addWatchAccount'
    | 'walletConnectApprove'
    | 'walletConnectReject'
    | 'walletConnectConfirm'
    | 'walletConnectDecline'

const ALGORAND = { [Key.ChainId]: 'algorand' }

/**
 * What each Algorand flow logs, in order. The Ethereum flow must log the same
 * names; values set per run (ids, addresses, dApp metadata) match any string.
 */
export const ALGORAND_FLOW_EVENTS: Record<
    AnalyticsFlow,
    readonly RecordedAnalyticsEvent[]
> = {
    send: [
        {
            name: TransactionsEvent.Complete,
            payload: {
                [Key.AssetId]: expect.any(String),
                [Key.Amount]: 1,
                [Key.TransactionId]: expect.any(String),
                [Key.AccountType]: expect.any(String),
                ...ALGORAND,
            },
        },
    ],
    sendFailed: [
        {
            name: TransactionsEvent.Failed,
            payload: {
                [Key.ErrorCode]: 'unclassified',
                [Key.IsRetryable]: expect.any(Boolean),
                ...ALGORAND,
            },
        },
    ],
    receive: [{ name: AnalyticsScreenName.ShowQr, payload: ALGORAND }],
    addWatchAccount: [
        { name: OnboardingEvent.WatchAccountComplete, payload: ALGORAND },
        { name: OnboardingEvent.NameAccount, payload: ALGORAND },
        {
            name: OnboardingEvent.RegisterAccount,
            payload: { [Key.AccountCreationType]: 'watch', ...ALGORAND },
        },
    ],
    walletConnectApprove: [
        {
            name: WalletConnectEvent.SessionApproved,
            payload: {
                [Key.DappName]: expect.any(String),
                [Key.DappUrl]: expect.any(String),
                [Key.AccountAddress]: expect.any(String),
                [Key.TotalAccount]: 1,
                ...ALGORAND,
            },
        },
    ],
    walletConnectReject: [
        {
            name: WalletConnectEvent.SessionRejected,
            payload: {
                [Key.DappName]: expect.any(String),
                [Key.DappUrl]: expect.any(String),
                ...ALGORAND,
            },
        },
    ],
    walletConnectConfirm: [
        {
            name: WalletConnectEvent.TransactionConfirmed,
            payload: {
                [Key.DappName]: expect.any(String),
                [Key.DappUrl]: expect.any(String),
                [Key.TransactionCount]: 1,
                ...ALGORAND,
            },
        },
    ],
    walletConnectDecline: [
        {
            name: WalletConnectEvent.TransactionDeclined,
            payload: {
                [Key.DappName]: expect.any(String),
                [Key.DappUrl]: expect.any(String),
                [Key.TransactionCount]: 1,
                ...ALGORAND,
            },
        },
    ],
}

export const flowEventNames = (flow: AnalyticsFlow): string[] =>
    ALGORAND_FLOW_EVENTS[flow].map(event => event.name)

/**
 * Asserts the flow logged its table's events in order, each on `chainId`. On
 * Algorand the payloads must also match the table exactly.
 */
export const expectFlowEvents = (
    recorder: AnalyticsRecorder,
    flow: AnalyticsFlow,
    chainId: ChainId,
): void => {
    const recorded = recorder.events(flowEventNames(flow))

    expect(recorded.map(event => event.name)).toEqual(flowEventNames(flow))
    for (const event of recorded) {
        expect(event.payload?.[Key.ChainId]).toBe(chainId)
    }
    if (chainId === 'algorand') {
        expect(recorded).toEqual(ALGORAND_FLOW_EVENTS[flow])
    }
}
