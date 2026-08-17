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
    | 'device_not_found'
    | 'device_busy'
    | 'usb_no_device'
    | 'usb_multiple_devices'
    | 'no_accounts_found'
    | 'location_services_disabled'
    | 'provider_unavailable'
    | 'interrupted'

/**
 * Connection-class failures, where the troubleshooting checklist (device on,
 * unlocked, nearby, Algorand app open, re-pair) is a useful supplement to the
 * error's own copy. The UI presets alias this set as `TROUBLESHOOTABLE_KINDS`
 * and render a link to the troubleshooting sheet for these kinds only.
 *
 * Kinds whose remediation is a single specific action (`user_rejected`,
 * `device_busy`, `address_mismatch`) stay out: a generic checklist would
 * dilute copy that already says exactly what to do.
 */
export const BLE_CLASS_ERROR_KINDS: ReadonlySet<LedgerErrorPresetKind> =
    new Set([
        'bluetooth_disabled',
        'bluetooth_permission',
        'scan_timeout',
        'connection_failed',
        'connection_lost',
        'device_not_found',
    ])

export const isBleClassErrorKind = (
    kind: LedgerErrorPresetKind | undefined,
): boolean => kind !== undefined && BLE_CLASS_ERROR_KINDS.has(kind)
