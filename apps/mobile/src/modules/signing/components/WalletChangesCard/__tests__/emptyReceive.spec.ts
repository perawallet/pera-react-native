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
import { emptyReceiveCopyOf } from '../emptyReceive'

describe('emptyReceiveCopyOf', () => {
    it('says nothing, with no caption', () => {
        expect(emptyReceiveCopyOf({ kind: 'nothing' })).toEqual({
            iconName: 'minus',
            title: { key: 'signing.review.nothing' },
        })
    })

    it('says it cannot tell, with its caption', () => {
        expect(emptyReceiveCopyOf({ kind: 'unknown' })).toEqual({
            iconName: 'question-mark',
            title: { key: 'signing.review.unknown' },
            captionKey: 'signing.review.unknown_receive_body',
        })
    })

    it('says not detected, and why', () => {
        expect(emptyReceiveCopyOf({ kind: 'not-detected' })).toEqual({
            iconName: 'question-mark',
            title: { key: 'signing.review.not_detected' },
            captionKey: 'signing.review.not_detected_receive_body',
        })
    })

    it('names the other network when it has one', () => {
        expect(
            emptyReceiveCopyOf({ kind: 'other-network', networkName: 'Base' }),
        ).toEqual({
            iconName: 'globe',
            title: {
                key: 'signing.review.on_network',
                params: { network: 'Base' },
            },
            captionKey: 'signing.review.other_network_receive_body',
        })
    })

    it('says another network when it has no name', () => {
        expect(emptyReceiveCopyOf({ kind: 'other-network' }).title).toEqual({
            key: 'signing.review.on_other_network',
        })
    })
})
