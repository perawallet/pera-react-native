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

/**
 * Account options menu actions. RN-specific events (no iOS equivalent) — the RN
 * per-account menu is richer than iOS, which only had a generic `rekey`.
 */
export enum AccountOptionsEvent {
    RekeyToLedger = 'accountscr_rekey_ledger_tap', // Started rekey to a Ledger account
    RekeyToStandard = 'accountscr_rekey_standard_tap', // Started rekey to a standard account
    RekeyToQuantum = 'accountscr_rekey_quantum_tap', // Started rekey to a quantum account
    ScanRekeyed = 'accountscr_scan_rekeyed_tap', // Started the rekeyed-accounts rescan
    Rename = 'accountscr_rename_tap', // Opened the rename-account flow
    Remove = 'accountscr_remove_tap', // Started removing the account
    ViewPassphrase = 'accountscr_view_passphrase_tap', // Opened view-passphrase
    CopyAddress = 'accountscr_copy_address_tap', // Copied the account address
}
