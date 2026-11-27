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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { IconName } from '@components/core'

/** What the receive side says when no item comes back. */
export type EmptyReceiveSide =
    /** Nothing comes back: a send, or a call Pera sees in full. */
    | { kind: 'nothing' }
    /** Something comes back whose amount Pera can't read. */
    | { kind: 'unknown' }
    /** Nothing seen on this network, and Pera can't see any other. */
    | { kind: 'not-detected' }
    /** Paid to the signer on another network; `networkName` is unset when Pera doesn't carry it. */
    | { kind: 'other-network'; networkName?: string }

export const NOTHING_RECEIVED: EmptyReceiveSide = { kind: 'nothing' }

export const RECEIVE_UNKNOWN: EmptyReceiveSide = { kind: 'unknown' }

export type EmptyReceiveCopy = {
    iconName: IconName
    title: { key: I18nKey; params?: { network: string } }
    captionKey?: I18nKey
}

export const emptyReceiveCopyOf = (
    side: EmptyReceiveSide,
): EmptyReceiveCopy => {
    switch (side.kind) {
        case 'nothing': {
            return {
                iconName: 'minus',
                title: { key: i18nKey('signing.review.nothing') },
            }
        }
        case 'unknown': {
            return {
                iconName: 'question-mark',
                title: { key: i18nKey('signing.review.unknown') },
                captionKey: i18nKey('signing.review.unknown_receive_body'),
            }
        }
        case 'not-detected': {
            return {
                iconName: 'question-mark',
                title: { key: i18nKey('signing.review.not_detected') },
                captionKey: i18nKey('signing.review.not_detected_receive_body'),
            }
        }
        case 'other-network': {
            return {
                iconName: 'globe',
                title: side.networkName
                    ? {
                          key: i18nKey('signing.review.on_network'),
                          params: { network: side.networkName },
                      }
                    : { key: i18nKey('signing.review.on_other_network') },
                captionKey: i18nKey(
                    'signing.review.other_network_receive_body',
                ),
            }
        }
    }
}
