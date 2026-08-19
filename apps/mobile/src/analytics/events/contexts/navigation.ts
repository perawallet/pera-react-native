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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Cross-app navigation events, fired centrally from the route focus listener. */
export enum NavigationEvent {
    // GA4's standard page-view name — allowed for manual logging, unlike
    // first_open/first_visit which the SDK reserves to itself.
    PageView = 'page_view',
}

export interface NavigationRequiredPayloads {
    [NavigationEvent.PageView]: {
        [Key.PageTitle]: string
        [Key.PreviousScreen]: string | null
        [Key.Path]?: string
    }
}
