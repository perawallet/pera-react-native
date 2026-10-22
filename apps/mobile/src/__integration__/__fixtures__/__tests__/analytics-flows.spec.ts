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

import { describe, expect, it } from 'vitest'
import type {
    AnalyticsRecorder,
    RecordedAnalyticsEvent,
} from '@test-utils/analytics-recorder'
import {
    ALGORAND_FLOW_EVENTS,
    expectFlowEvents,
    flowEventNames,
} from '../analytics-flows'

const recorderOf = (
    recorded: readonly RecordedAnalyticsEvent[],
): AnalyticsRecorder => ({
    events: names =>
        recorded.filter(event => !names || names.includes(event.name)),
    restore: () => {},
})

const RECEIVE_ON_ETHEREUM: RecordedAnalyticsEvent[] = [
    { name: 'screen_show_qr', payload: { chain_id: 'ethereum' } },
]

describe('expectFlowEvents', () => {
    it("passes when the flow logs its table's names on the given chain, ignoring other events", () => {
        const recorder = recorderOf([
            { name: 'scr_qrview_view', payload: {} },
            ...RECEIVE_ON_ETHEREUM,
        ])

        expect(() =>
            expectFlowEvents(recorder, 'receive', 'ethereum'),
        ).not.toThrow()
    })

    it('fails when an event names another chain', () => {
        expect(() =>
            expectFlowEvents(
                recorderOf(RECEIVE_ON_ETHEREUM),
                'receive',
                'algorand',
            ),
        ).toThrow()
    })

    it('fails when the flow misses an event', () => {
        expect(() =>
            expectFlowEvents(recorderOf([]), 'receive', 'ethereum'),
        ).toThrow()
    })

    it('holds Algorand to the golden payloads', () => {
        const recorder = recorderOf([
            {
                name: 'screen_show_qr',
                payload: { chain_id: 'algorand', extra: true },
            },
        ])

        expect(() =>
            expectFlowEvents(recorder, 'receive', 'algorand'),
        ).toThrow()
    })
})

describe('flowEventNames', () => {
    it('lists every row of the flow in order', () => {
        expect(flowEventNames('addWatchAccount')).toEqual(
            ALGORAND_FLOW_EVENTS.addWatchAccount.map(({ name }) => name),
        )
        expect(flowEventNames('addWatchAccount')).toEqual([
            'onb_welcome_watch_complete',
            'new_onb_welcome_name_wallet',
            'register',
        ])
    })
})
