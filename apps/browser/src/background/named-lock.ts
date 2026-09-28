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

// jsdom has no navigator.locks, and a bare fallback would silently drop
// serialisation under test, so each name gets a same-realm FIFO instead.
const queues = new Map<string, Promise<void>>()

export const withNamedLock = async <T>(
    name: string,
    fn: () => Promise<T>,
): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return (await navigator.locks.request(name, fn)) as T
    }
    const previous = queues.get(name) ?? Promise.resolve()
    let release = (): void => {}
    queues.set(
        name,
        new Promise<void>(resolve => {
            release = resolve
        }),
    )
    await previous
    try {
        return await fn()
    } finally {
        release()
    }
}
