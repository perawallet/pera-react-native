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

import type { Optional } from '@perawallet/wallet-core-shared'
import { hasCustody } from './credentials/accessors'
import type { WalletAccount } from './models'
import { isLedgerAccount } from './utils'

export type AccountNameKind = 'account' | 'shared' | 'ledger'

export type AccountNameTemplates = Record<AccountNameKind, string>

const NUMBER_PLACEHOLDER = '{{number}}'

/** English, used until the app hands over its translations, and by the store migration. */
export const DEFAULT_ACCOUNT_NAME_TEMPLATES: AccountNameTemplates = {
    account: `Account #${NUMBER_PLACEHOLDER}`,
    shared: `Shared Account #${NUMBER_PLACEHOLDER}`,
    ledger: `Ledger Account #${NUMBER_PLACEHOLDER}`,
}

let templates: AccountNameTemplates = { ...DEFAULT_ACCOUNT_NAME_TEMPLATES }

/** Takes the app's translations; one without the `{{number}}` placeholder is ignored. */
export const setAccountNameTemplates = (next: AccountNameTemplates): void => {
    templates = Object.fromEntries(
        Object.entries(next).map(([kind, template]) => [
            kind,
            template.includes(NUMBER_PLACEHOLDER)
                ? template
                : templates[kind as AccountNameKind],
        ]),
    ) as AccountNameTemplates
}

export const accountNameKindOf = (account: WalletAccount): AccountNameKind => {
    if (isLedgerAccount(account)) return 'ledger'
    return hasCustody(account, 'multisig') ? 'shared' : 'account'
}

const formatName = (template: string, number: number): string =>
    template.replace(NUMBER_PLACEHOLDER, String(number))

// Names compare as the app's uniqueness check does: ignoring case and
// surrounding spaces, so a suggested name is never one already taken.
const normalized = (text: string): string => text.normalize('NFC').toLowerCase()

const numberInName = (template: string, name: string): Optional<number> => {
    const at = template.indexOf(NUMBER_PLACEHOLDER)
    const prefix = normalized(template.slice(0, at))
    const suffix = normalized(template.slice(at + NUMBER_PLACEHOLDER.length))
    const text = normalized(name.trim())
    if (!text.startsWith(prefix) || !text.endsWith(suffix)) return undefined
    const digits = text.slice(prefix.length, text.length - suffix.length)
    return /^\d+$/.test(digits) ? Number(digits) : undefined
}

// One past the highest number any name in `template` uses: a removed
// account's number is never handed out again.
const nextNumber = (
    accounts: readonly WalletAccount[],
    template: string,
): number =>
    accounts.reduce(
        (max, { name }) =>
            Math.max(max, (name && numberInName(template, name)) || 0),
        0,
    ) + 1

// A record built by hand or parsed from JSON can arrive with no name at all.
export const isUnnamed = (account: WalletAccount): boolean =>
    !account.name?.trim()

export const nextAccountName = (
    accounts: readonly WalletAccount[],
    kind: AccountNameKind = 'account',
): string => formatName(templates[kind], nextNumber(accounts, templates[kind]))

/** Names each unnamed account in list order, counting up per kind from the next free number. */
export const withAccountNames = (
    accounts: readonly WalletAccount[],
    using: AccountNameTemplates = templates,
): WalletAccount[] => {
    const next = new Map<AccountNameKind, number>()
    return accounts.map(account => {
        if (!isUnnamed(account)) return account
        const kind = accountNameKindOf(account)
        const number = next.get(kind) ?? nextNumber(accounts, using[kind])
        next.set(kind, number + 1)
        return { ...account, name: formatName(using[kind], number) }
    })
}
