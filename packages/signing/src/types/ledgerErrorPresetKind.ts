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
 * Mirror of the UI-side `LedgerErrorPresetKind` union, lifted into the
 * signing package so the store can carry an error kind without creating
 * a circular dep on the mobile module. Must stay in sync with
 * `apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts`.
 */
export type LedgerErrorPresetKind =
    | 'bluetooth_disabled'
    | 'bluetooth_permission'
    | 'scan_timeout'
    | 'timeout'
    | 'connection_failed'
    | 'connection_lost'
    | 'user_rejected'
    | 'signing_failed'
    | 'transmission_error'
    | 'public_key_read_failed'
    | 'app_not_open'
    | 'address_mismatch'
    | 'network_error'
    | 'unsupported_device'
    | 'app_outdated'
    | 'device_locked'
    | 'usb_no_device'
    | 'usb_multiple_devices'
    | 'no_accounts_found'
    | 'location_services_disabled'
    | 'provider_unavailable'

/**
 * Subset of error kinds where the user-facing remediation lives in the
 * troubleshooting bottom sheet rather than the inline error UI. Consumed
 * by both the actor lifecycle (via `isBleClassErrorKind`) and the UI
 * presets (which alias this set as `TROUBLESHOOTABLE_KINDS`), so the two
 * cannot drift.
 *
 * For these kinds we leave the hardware-signing store in `error` state on
 * a terminal failure so the troubleshooting sheet stays open until the
 * user closes it. Other failure kinds reset the store synchronously to
 * free up the next signing request.
 */
export const BLE_CLASS_ERROR_KINDS: ReadonlySet<LedgerErrorPresetKind> =
    new Set([
        'bluetooth_disabled',
        'bluetooth_permission',
        'scan_timeout',
        'connection_failed',
        'connection_lost',
    ])

export const isBleClassErrorKind = (
    kind: LedgerErrorPresetKind | undefined,
): boolean => kind !== undefined && BLE_CLASS_ERROR_KINDS.has(kind)
