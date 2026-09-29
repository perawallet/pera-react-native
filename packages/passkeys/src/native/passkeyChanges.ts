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

const listeners = new Set<() => void>()

/**
 * On iOS and Android a credential is a flat MMKV record that the reactive
 * keystore store never holds, so watching that store misses it. The native
 * writer and the removal mutation announce their changes here; a credential
 * the OS provider mints out of process does not.
 */
export const subscribeToPasskeyChanges = (
    listener: () => void,
): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const notifyPasskeyChanged = (): void => {
    for (const listener of listeners) listener()
}
