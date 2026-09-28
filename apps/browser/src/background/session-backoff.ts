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

type BackoffRecord = { failures: number; nextAttemptAt: number }

export type SessionBackoff = {
    isBlocked: () => Promise<boolean>
    recordFailure: () => Promise<void>
    clear: () => Promise<void>
}

// In chrome.storage.session so a failure survives worker eviction and a
// relaunch starts clean.
export const createSessionBackoff = ({
    key,
    floorMs,
    capMs,
}: {
    key: string
    floorMs: number
    capMs: number
}): SessionBackoff => {
    const read = async (): Promise<BackoffRecord> => {
        const stored = await chrome.storage.session.get(key)
        const value = stored[key] as Partial<BackoffRecord> | undefined
        return {
            failures: typeof value?.failures === 'number' ? value.failures : 0,
            nextAttemptAt:
                typeof value?.nextAttemptAt === 'number'
                    ? value.nextAttemptAt
                    : 0,
        }
    }

    return {
        isBlocked: async () => (await read()).nextAttemptAt > Date.now(),
        recordFailure: async () => {
            const { failures } = await read()
            const next = failures + 1
            const delay = Math.min(floorMs * 2 ** (next - 1), capMs)
            await chrome.storage.session.set({
                [key]: { failures: next, nextAttemptAt: Date.now() + delay },
            })
        },
        clear: async () => {
            await chrome.storage.session.remove(key)
        },
    }
}
