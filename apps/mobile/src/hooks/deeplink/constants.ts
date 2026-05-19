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

/**
 * URI scheme names used by Pera deeplink handling. Each constant is the
 * scheme name only — append `://` (hierarchical) or `:` (opaque) at the
 * use site so every URI reads as `${SCHEME}://${rest}` or `${SCHEME}:${rest}`
 * consistently.
 */
export const PERAWALLET_SCHEME = 'perawallet'
export const PERAWALLET_WC_SCHEME = 'perawallet-wc'
export const WC_SCHEME = 'wc'
export const ALGORAND_SCHEME = 'algorand'
export const ALGO_SCHEME = 'algo'

/**
 * Universal-link base for QR-share URLs that mirror native scheme handlers.
 */
export const PERAWALLET_UNIVERSAL_LINK_HOST = 'https://perawallet.app'
