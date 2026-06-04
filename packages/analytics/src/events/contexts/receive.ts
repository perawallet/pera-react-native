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

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Receive funds / QR sharing. */
export enum ReceiveEvent {
    QrCopy = 'tap_show_qr_copy',
    QrShare = 'tap_show_qr_share',
    QrShareComplete = 'tap_show_qr_share_complete',
    NftReceive = 'nftscr_nft_receive',
    ReceiveTab = 'tap_tab_receive',
}

export interface ReceiveRequiredPayloads {
    [ReceiveEvent.QrCopy]: {
        [Key.AccountAddress]: string
    }
    [ReceiveEvent.QrShare]: {
        [Key.AccountAddress]: string
    }
    [ReceiveEvent.QrShareComplete]: {
        [Key.AccountAddress]: string
    }
}
