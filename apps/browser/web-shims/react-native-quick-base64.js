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

// Web shim for react-native-quick-base64.
// The native package calls TurboModuleRegistry.getEnforcing('QuickBase64')
// which is unavailable in browser environments. This shim provides the same
// API surface using browser-native btoa/atob and Uint8Array operations.

/**
 * @param {string} b64
 * @returns {[number, number]}
 */
function getLens(b64) {
    const len = b64.length
    if (len % 4 > 0) throw new Error('Invalid string. Length must be a multiple of 4')
    let validLen = b64.indexOf('=')
    if (validLen === -1) validLen = len
    const placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4)
    return [validLen, placeHoldersLen]
}

/** @param {string} b64 */
export function byteLength(b64) {
    const [validLen, placeHoldersLen] = getLens(b64)
    return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen
}

/** @param {string} b64 @param {boolean} [removeLinebreaks] */
export function toByteArray(b64, removeLinebreaks = false) {
    const clean = removeLinebreaks ? b64.replace(/[\r\n]/g, '') : b64
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

/** @param {Uint8Array} uint8 @param {boolean} [urlSafe] */
export function fromByteArray(uint8, urlSafe = false) {
    const CHUNK_SIZE = 0x8000 // oxlint-disable-line unicorn/numeric-separators-style -- vendored shim constant
    let binary = ''
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode.apply(
            null,
            uint8.subarray(i, i + CHUNK_SIZE),
        )
    }
    const b64 = btoa(binary)
    return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_') : b64
}

/** @param {string} str */
export const trimBase64Padding = (str) => str.replace(/[.=]{1,2}$/, '')
