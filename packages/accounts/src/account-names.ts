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
import {
    addressCodecs,
    CHAIN_IDS,
} from '@perawallet/wallet-core-chain-contract'
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
// Numbering reads names in every language, so it continues past names given
// in another one, such as the English the store migration writes.
let knownTemplates: AccountNameTemplates[] = [DEFAULT_ACCOUNT_NAME_TEMPLATES]

/**
 * Takes the app's translations: `next` names new accounts, `known` holds
 * every language's. A template without the `{{number}}` placeholder is ignored.
 */
export const setAccountNameTemplates = (
    next: AccountNameTemplates,
    known: readonly AccountNameTemplates[] = [],
): void => {
    templates = Object.fromEntries(
        Object.entries(next).map(([kind, template]) => [
            kind,
            template.includes(NUMBER_PLACEHOLDER)
                ? template
                : templates[kind as AccountNameKind],
        ]),
    ) as AccountNameTemplates
    knownTemplates = [DEFAULT_ACCOUNT_NAME_TEMPLATES, ...known]
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

// One past the highest number any name of this kind uses, in any language: a
// removed account's number is never handed out again.
const nextNumber = (
    accounts: readonly WalletAccount[],
    kind: AccountNameKind,
    template: string,
): number => {
    const kindTemplates = new Set(
        [template, ...knownTemplates.map(known => known[kind])].filter(t =>
            t.includes(NUMBER_PLACEHOLDER),
        ),
    )
    let max = 0
    for (const { name } of accounts) {
        if (!name) continue
        for (const t of kindTemplates) {
            max = Math.max(max, numberInName(t, name) ?? 0)
        }
    }
    return max + 1
}

// The native apps auto-named accounts with a 6+6 cut of the address, kept
// verbatim through migration and backups. Any `...`/`…` cut, or the full address.
const TRUNCATION_SEPARATORS = ['...', '…'] as const

// Split on the first separator by index: a backtracking regex here runs in
// polynomial time on long names.
const splitTruncation = (name: string): Optional<[string, string]> => {
    const cuts = TRUNCATION_SEPARATORS.flatMap(separator => {
        const at = name.indexOf(separator, 1)
        return at === -1 ? [] : [{ at, separator }]
    })
    if (cuts.length === 0) return undefined
    const { at, separator } = cuts.reduce((a, b) => (b.at < a.at ? b : a))
    const suffix = name.slice(at + separator.length)
    return suffix.length > 0 ? [name.slice(0, at), suffix] : undefined
}

const isNameOfAddress = (name: string, address: string): boolean => {
    if (name === address) return true
    const parts = splitTruncation(name)
    if (!parts) return false
    const [prefix, suffix] = parts
    return (
        prefix.length + suffix.length < address.length &&
        address.startsWith(prefix) &&
        address.endsWith(suffix)
    )
}

// A name that is the account's own address becomes that chain's truncation,
// so it equals the address line beneath it and the row shows it once.
const withCodecTruncatedName = (account: WalletAccount): WalletAccount => {
    const { name } = account
    if (!name) return account
    for (const chainId of CHAIN_IDS) {
        const address = account.chains[chainId]?.address
        if (!address || !isNameOfAddress(name, address)) continue
        const truncated = addressCodecs.has(chainId)
            ? addressCodecs.get(chainId).truncate(address)
            : address
        return truncated === name ? account : { ...account, name: truncated }
    }
    return account
}

// A record built by hand or parsed from JSON can arrive with no name at all.
export const isUnnamed = (account: WalletAccount): boolean =>
    !account.name?.trim()

export const nextAccountName = (
    accounts: readonly WalletAccount[],
    kind: AccountNameKind = 'account',
): string =>
    formatName(templates[kind], nextNumber(accounts, kind, templates[kind]))

/**
 * Names each unnamed account in list order, counting up per kind from the next
 * free number, and gives a name that is the account's own address the chain's truncation.
 */
export const withAccountNames = (
    accounts: readonly WalletAccount[],
    using: AccountNameTemplates = templates,
): WalletAccount[] => {
    const next = new Map<AccountNameKind, number>()
    return accounts.map(account => {
        if (!isUnnamed(account)) return withCodecTruncatedName(account)
        const kind = accountNameKindOf(account)
        const number = next.get(kind) ?? nextNumber(accounts, kind, using[kind])
        next.set(kind, number + 1)
        return { ...account, name: formatName(using[kind], number) }
    })
}
