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

const isAcceptedAlone = async <T>(
    account: string,
    read: OwnedAccountsReader<T>,
): Promise<boolean> => {
    try {
        await read([account], PROBE_LIMIT)
        return true
    } catch (error) {
        if (isAccountNotOnDeviceError(error)) return false
        throw error
    }
}

/**
 * Reads history for `accounts`, or for the ones the device holds when the
 * router refuses the list. It refuses the whole list over one account without
 * naming it, so each is tried alone; when it holds none, the refusal stands.
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
        const accepted = await Promise.all(
            accounts.map(account => isAcceptedAlone(account, read)),
        )
        const owned = accounts.filter((_, index) => accepted[index])
        if (owned.length === 0) throw error
        return { value: await read(owned), accounts: owned }
    }
}
