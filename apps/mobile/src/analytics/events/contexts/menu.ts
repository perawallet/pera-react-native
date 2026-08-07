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

/** Menu screen actions. */
export enum MenuEvent {
    QrScan = 'menuscr_qr_scan', // Tapped QR scan in menu
    Receive = 'menuscr_receive_tap', // Tapped Receive in menu
    Stake = 'menuscr_stake_tap', // Tapped Stake in menu
    PasteLink = 'menuscr_paste_link_tap', // Tapped paste-a-link in menu
}
