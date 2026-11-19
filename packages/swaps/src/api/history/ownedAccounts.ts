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

import { isAccountNotOnDeviceError } from '../../utils/routerErrors'

export type OwnedAccountsRead<T> = {
    value: T
    /** The router account ids `value` was read for. */
    accounts: string[]
}

// A probe only needs the router's yes or no, not a page of rows.
const PROBE_LIMIT = 1

/** `limit` is set only for a probe; a real read uses its own page size. */
export type OwnedAccountsReader<T> = (
    accounts: string[],
    limit?: number,
) => Promise<T>

type Probed = {
    accepted: string[]
    /** Probe failures other than the refusal, such as a 429 or going offline. */
    failures: unknown[]
}

const NOTHING_PROBED: Probed = { accepted: [], failures: [] }

const merge = (left: Probed, right: Probed): Probed => ({
    accepted: [...left.accepted, ...right.accepted],
    failures: [...left.failures, ...right.failures],
})

// Halving finds one refused account in about 2·log2(n) requests, so a large
// batch doesn't trip the router's rate limit. Refusals tend to cover a whole
// chain, which is why the caller groups the list by chain before halving.
const halvesOf = async <T>(
    accounts: string[],
    read: OwnedAccountsReader<T>,
): Promise<Probed> => {
    const middle = Math.ceil(accounts.length / 2)
    const [left, right] = await Promise.all([
        probe(accounts.slice(0, middle), read),
        probe(accounts.slice(middle), read),
    ])
    return merge(left, right)
}

const probe = async <T>(
    accounts: string[],
    read: OwnedAccountsReader<T>,
): Promise<Probed> => {
    try {
        await read(accounts, PROBE_LIMIT)
        return { accepted: accounts, failures: [] }
    } catch (error) {
        if (!isAccountNotOnDeviceError(error)) {
            return { accepted: [], failures: [error] }
        }
        return accounts.length === 1 ? NOTHING_PROBED : halvesOf(accounts, read)
    }
}

/**
 * Reads history for `accounts`, or for the ones the device holds when the
 * router refuses the list. It refuses the whole list over one account without
 * naming it, so the list is halved until each refused part is one account.
 * An account whose probe failed otherwise is left out while another is read;
 * when none is accepted, that failure, or else the refusal, stands.
 */
export const readForOwnedAccounts = async <T>(
    accounts: string[],
    read: OwnedAccountsReader<T>,
): Promise<OwnedAccountsRead<T>> => {
    try {
        return { value: await read(accounts), accounts }
    } catch (error) {
        if (!isAccountNotOnDeviceError(error) || accounts.length < 2) {
            throw error
        }
        // A router account id leads with its chain's CAIP-2 id, so sorting groups by chain.
        const byChain = [...accounts].sort()
        const { accepted, failures } = await halvesOf(byChain, read)
        if (accepted.length === 0) throw failures.at(0) ?? error
        const isAccepted = new Set(accepted)
        const owned = accounts.filter(account => isAccepted.has(account))
        return { value: await read(owned), accounts: owned }
    }
}
