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

export const name = '@perawallet/wallet-core-site-safety'

export type {
    ActiveGenerations,
    AssessSiteSafetyParams,
    ImpersonationTarget,
    PhishingListEntries,
    PhishingListEntryKind,
    PhishingListRefreshOutcome,
    PhishingListSnapshot,
    PhishingListSource,
    PhishingListSourceId,
    SiteHost,
    SiteSafetyVerdict,
} from './models'
export {
    PHISHING_LIST_SOURCES,
    isCompleteList,
    parseMetaMaskPhishingConfig,
    parseMewDarklist,
    parsePolkadotPhishingList,
} from './sources'
export { normalizeListedAddresses, toListedAddressKey } from './addresses'
export { listLookupCandidates, toSiteHost } from './host'
export { toConfusableSkeleton } from './confusables'
export { findImpersonatedTarget } from './lookAlike'
export { WELL_KNOWN_DAPPS } from './wellKnownDapps'
export {
    PhishingListAddressesSchema,
    PhishingListDomainsSchema,
} from './db/schema'
export {
    countGenerationRows,
    deleteOtherGenerations,
    findImpersonationTargetDomains,
    findListedAddresses,
    findListedDomains,
    writePhishingListGeneration,
} from './db/repository'
export {
    PHISHING_LIST_STORE_NAME,
    selectActiveGenerations,
    usePhishingListStore,
    type PhishingListSourceState,
    type PhishingListStore,
} from './store/store'
export {
    ensurePhishingListsSeeded,
    loadBundledPhishingLists,
    whenPhishingListsSeeded,
    type EnsurePhishingListsSeededOptions,
} from './seed'
export {
    PHISHING_LIST_REFRESH_AGE_MS,
    refreshPhishingLists,
    type RefreshPhishingListsOptions,
} from './refresh'
export {
    PHISHING_LIST_CHECK_INTERVAL_MS,
    startPhishingListRefresh,
} from './scheduler'
export { assessSiteSafety } from './assess'
export { findPhishingListedAddresses } from './listedAddresses'
export { siteSafetyQueryKeys } from './hooks/querykeys'
export {
    useSiteSafetyQuery,
    type UseSiteSafetyQueryParams,
    type UseSiteSafetyQueryResult,
} from './hooks/useSiteSafetyQuery'
export {
    useListedAddressesQuery,
    type UseListedAddressesQueryParams,
    type UseListedAddressesQueryResult,
} from './hooks/useListedAddressesQuery'
