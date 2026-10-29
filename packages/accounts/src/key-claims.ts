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

/** Who made a claim, so a walk can tell the claims its own adds made from other flows'. */
import type { Optional } from '@perawallet/wallet-core-shared'

export type ClaimOwner = object

let activeWalks = 0
const derivingNow = new Map<string, number>()
const claimedDuringWalks = new Map<string, Set<Optional<ClaimOwner>>>()

const claim = (keyPairId: string, delta: 1 | -1) => {
    const count = (derivingNow.get(keyPairId) ?? 0) + delta
    if (count > 0) derivingNow.set(keyPairId, count)
    else derivingNow.delete(keyPairId)
}

const recordDuringWalk = (keyPairId: string, owner?: ClaimOwner) => {
    if (activeWalks === 0) return
    const owners = claimedDuringWalks.get(keyPairId) ?? new Set()
    owners.add(owner)
    claimedDuringWalks.set(keyPairId, owners)
}

/**
 * Derives a key a flow will store on an account, keeping it out of the cleanup
 * of every walk running while it derives or when it resolves, until all of
 * them end: the account is only stored after the derivation, possibly after a
 * walk has listed the key as unused. A walk that starts after the derive
 * resolves sees the key as unclaimed until its account is stored.
 * `expectedKeyPairId` covers the derivation in flight, before its id is known.
 */
export const deriveClaimedKey = async <T extends { keyPairId: string }>(
    expectedKeyPairId: Optional<string>,
    derive: () => Promise<T>,
    owner?: ClaimOwner,
): Promise<T> => {
    if (expectedKeyPairId !== undefined) claim(expectedKeyPairId, 1)
    try {
        const derived = await derive()
        recordDuringWalk(derived.keyPairId, owner)
        return derived
    } finally {
        if (expectedKeyPairId !== undefined) {
            claim(expectedKeyPairId, -1)
            recordDuringWalk(expectedKeyPairId, owner)
        }
    }
}

/** Whether a flow is deriving the key, or claimed it since the running walks started. */
export const isKeyClaimed = (keyPairId: string): boolean =>
    derivingNow.has(keyPairId) || claimedDuringWalks.has(keyPairId)

/** Whether a flow other than `owner` is deriving the key, or claimed it since the running walks started. */
export const isKeyClaimedByOthers = (
    keyPairId: string,
    owner: ClaimOwner,
): boolean =>
    derivingNow.has(keyPairId) ||
    [...(claimedDuringWalks.get(keyPairId) ?? [])].some(
        claimant => claimant !== owner,
    )

/** Runs a discovery walk, recording the keys other flows derive until every walk ends. */
export const trackWalk = async <T>(run: () => Promise<T>): Promise<T> => {
    activeWalks++
    try {
        return await run()
    } finally {
        activeWalks--
        if (activeWalks === 0) claimedDuringWalks.clear()
    }
}
