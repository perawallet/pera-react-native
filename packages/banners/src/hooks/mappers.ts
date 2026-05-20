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

import type { BannerResponse } from '../api/banners'
import type { SpotBannerResponse } from '../api/spot-banners'
import type { Banner, SpotBanner } from '../models'

export const mapBannerResponse = (response: BannerResponse): Banner => ({
    id: response.id,
    type: response.type,
    title: response.title ?? null,
    subtitle: response.subtitle ?? null,
    buttonLabel: response.button_label ?? null,
    buttonUrl: response.button_url ?? null,
    isButtonUrlExternal: response.is_button_url_external ?? false,
    autoOpenMode: response.auto_open_mode ?? null,
    backgroundImageUrl: response.background_image ?? null,
})

export const hasRenderableContent = (banner: Banner): boolean =>
    Boolean(banner.title || banner.subtitle || banner.buttonLabel)

export const mapSpotBannerResponse = (
    response: SpotBannerResponse,
): SpotBanner => ({
    id: response.id,
    text: response.text,
    imageUrl: response.image,
    url: response.url,
    isUrlExternal: response.button_url_is_external ?? false,
})
