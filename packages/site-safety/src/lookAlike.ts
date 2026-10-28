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

import { toConfusableSkeleton } from './confusables'
import { isWithinDomain, publicSuffixLabelCount } from './host'
import type { ImpersonationTarget, SiteHost } from './models'

// Shorter names are common words: `pact` inside `impact` is no imitation.
const MIN_CONTAINED_NAME_LENGTH = 5
const MIN_TYPO_NAME_LENGTH = 6

/** The label left of the public suffix: `uniswap` for `app.uniswap.org`. */
const nameLabelOf = (domain: string): string => {
    const labels = domain.split('.')
    return labels.at(-(publicSuffixLabelCount(domain) + 1)) ?? labels[0] ?? ''
}

const isOneEditApart = (a: string, b: string): boolean => {
    if (Math.abs(a.length - b.length) > 1 || a === b) return false
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
    let i = 0
    let j = 0
    let edits = 0
    while (i < shorter.length && j < longer.length) {
        if (shorter[i] === longer[j]) {
            i++
            j++
            continue
        }
        if (++edits > 1) return false
        if (shorter.length === longer.length) i++
        j++
    }
    return edits + (longer.length - j) + (shorter.length - i) <= 1
}

const ownDomainsOf = (target: ImpersonationTarget): readonly string[] => [
    target.domain,
    ...(target.otherDomains ?? []),
]

/**
 * The well-known site `host` imitates, if any. Any label that reads as a
 * target's name counts (homoglyphs, punycode, `uniswap.evil.com`). Containing
 * the name or a one-letter typo counts only in the label left of the public
 * suffix: `uniswap-claim.vercel.app` is caught, a subdomain such as
 * `docs-uniswap.example.com` is not. Every target's own domains and
 * list-allowed domains are never flagged.
 */
export const findImpersonatedTarget = (
    host: SiteHost,
    targets: readonly ImpersonationTarget[],
    allowDomains: readonly string[],
): ImpersonationTarget | undefined => {
    const exempt = [...targets.flatMap(ownDomainsOf), ...allowDomains]
    if (exempt.some(domain => isWithinDomain(host.ascii, domain))) {
        return undefined
    }

    // Labels count the same in both forms: punycode encodes label by label.
    const labels = host.unicode
        .split('.')
        .slice(0, -publicSuffixLabelCount(host.ascii))
        .map(toConfusableSkeleton)
    const registrableLabel = labels.at(-1) ?? ''

    return targets.find(target => {
        const name = toConfusableSkeleton(nameLabelOf(target.domain))
        if (name.length === 0) return false
        if (labels.some(label => label === name)) return true
        return (
            (name.length >= MIN_CONTAINED_NAME_LENGTH &&
                registrableLabel.includes(name)) ||
            (name.length >= MIN_TYPO_NAME_LENGTH &&
                isOneEditApart(registrableLabel, name))
        )
    })
}
