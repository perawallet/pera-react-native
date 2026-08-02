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

/** Scheme names only — call sites append `://` (hierarchical) or `:` (opaque). */
export const PERAWALLET_SCHEME = 'perawallet'
export const PERAWALLET_WC_SCHEME = 'perawallet-wc'
export const WC_SCHEME = 'wc'

/**
 * Registered by the native iOS app. The parser rewrites `algorand-wc:` -> `wc:`
 * so existing links keep routing after the RN migration.
 */
export const ALGORAND_WC_SCHEME = 'algorand-wc'
export const ALGORAND_SCHEME = 'algorand'
export const ALGO_SCHEME = 'algo'
/**
 * The OS routes `fido://…` opens to the registered credential provider
 * extension, so we only recognize the scheme and hand the URL back.
 */
export const FIDO_SCHEME = 'fido'

/**
 * Recognised today only so QR/deeplink callers don't fall through to "invalid
 * URL"; the dispatcher logs a placeholder until the Liquid Auth flow lands.
 */
export const LIQUID_SCHEME = 'liquid'

/** Universal-link base for QR-share URLs mirroring the native handlers. */
export const PERAWALLET_UNIVERSAL_LINK_HOST = 'https://perawallet.app'
