/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** Home screen banners. */
export enum BannersEvent {
    Governance = 'homescr_visitgovernance', // Tapped the governance banner
    Retail = 'homescr_visitretail', // Tapped the retail banner
    Staking = 'homescr_visitstaking', // Tapped the staking banner
    Generic = 'homescr_visitgeneric', // Tapped a generic banner
    Spot = 'homescr_banner_click', // Tapped a spot banner (includes which banner)
    SpotClose = 'homescr_banner_close_click', // Closed a spot banner (includes which banner)
}

export interface BannersRequiredPayloads {
    [BannersEvent.Spot]: {
        [Key.BannerName]: string
    }
    [BannersEvent.SpotClose]: {
        [Key.BannerName]: string
    }
}
