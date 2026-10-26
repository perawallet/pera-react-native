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

let activeWalks = 0
const derivingNow = new Map<string, number>()
const derivedDuringWalks = new Set<string>()

const claim = (keyPairId: string, delta: 1 | -1) => {
    const count = (derivingNow.get(keyPairId) ?? 0) + delta
    if (count > 0) derivingNow.set(keyPairId, count)
    else derivingNow.delete(keyPairId)
}

/**
 * Derives a key a flow will store on an account, keeping it out of every
 * discovery walk's cleanup: the account referencing it is only stored after
 * the derivation, possibly after a walk has already listed the key as unused.
 * `expectedKeyPairId` covers the derivation in flight, before its id is known.
 */
export const deriveClaimedKey = async <T extends { keyPairId: string }>(
    expectedKeyPairId: string | undefined,
    derive: () => Promise<T>,
): Promise<T> => {
    if (expectedKeyPairId !== undefined) claim(expectedKeyPairId, 1)
    try {
        const derived = await derive()
        if (activeWalks > 0) derivedDuringWalks.add(derived.keyPairId)
        return derived
    } finally {
        if (expectedKeyPairId !== undefined) {
            claim(expectedKeyPairId, -1)
            if (activeWalks > 0) derivedDuringWalks.add(expectedKeyPairId)
        }
    }
}

/** Whether a flow other than a walk is deriving the key, or derived it since the running walks started. */
export const isKeyClaimed = (keyPairId: string): boolean =>
    derivingNow.has(keyPairId) || derivedDuringWalks.has(keyPairId)

/** Runs a discovery walk, recording the keys other flows derive until every walk ends. */
export const trackWalk = async <T>(run: () => Promise<T>): Promise<T> => {
    activeWalks++
    try {
        return await run()
    } finally {
        activeWalks--
        if (activeWalks === 0) derivedDuringWalks.clear()
    }
}
