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

// Build-time stand-in for @react-native-async-storage/async-storage, which
// Pera does not ship. @walletconnect/keyvaluestorage's react-native entry
// requires it at module scope and @walletconnect/core loads that entry even
// when a custom `storage` is supplied, so the specifier reaches the bundler
// whatever the wallet actually persists with.
//
// Every member throws instead of no-op'ing: a silent store reads as a working
// wallet that forgets every session, and the throw is what proves the real
// MMKV store (getProvider().keyValueStorage, passed as Core({ storage })) is
// the one being used.

const unavailable = (member: string): never => {
    throw new Error(
        `AsyncStorage is not available in Pera Wallet (${member}). ` +
            'Pass the MMKV key-value store explicitly, e.g. Core({ storage }).',
    )
}

export const asyncStorageUnavailable = {
    getItem: () => unavailable('getItem'),
    setItem: () => unavailable('setItem'),
    removeItem: () => unavailable('removeItem'),
    mergeItem: () => unavailable('mergeItem'),
    clear: () => unavailable('clear'),
    getAllKeys: () => unavailable('getAllKeys'),
    flushGetRequests: () => unavailable('flushGetRequests'),
    multiGet: () => unavailable('multiGet'),
    multiSet: () => unavailable('multiSet'),
    multiRemove: () => unavailable('multiRemove'),
    multiMerge: () => unavailable('multiMerge'),
}

export const createAsyncStorage = () => unavailable('createAsyncStorage')

export const useAsyncStorage = () => unavailable('useAsyncStorage')

// The real package's store is its default export and that is what
// keyvaluestorage reaches for, so the stub has to carry one too.
export default asyncStorageUnavailable
