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

/** Menu screen actions. */
export enum MenuEvent {
    QrScan = 'menuscr_qr_scan',
    Nfts = 'menuscr_nfts_tap',
    Transfer = 'menuscr_transfer_tap',
    BuyAlgo = 'menuscr_buyalgo_tap',
    Receive = 'menuscr_receive_tap',
    Stake = 'menuscr_stake_tap',
    InviteFriends = 'menuscr_invite_friends_tap',
    CloseInviteFriends = 'menuscr_invite_close_tap',
    ShareInviteFriends = 'menuscr_invite_share_tap',
}
