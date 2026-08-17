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

// Main entry deliberately re-exports only the pieces that never carry a
// react-native-pager-view dependency. `MessagesSpotBanners` (->
// SpotBannerCarousel) and `BannersCarouselModalScreen` (-> BannerCarousel)
// both use PagerView; re-exporting them here would mean any consumer that
// imports so much as `HomeBannersStrip` from this barrel drags the carousel
// — and its native dependency — along too (this is exactly how
// react-native-pager-view previously leaked into the web bundle:
// AccountScreen only wanted HomeBannersStrip). Import those two directly
// from their own subpaths (`@modules/banners/components/MessagesSpotBanners`,
// `@modules/banners/screens/BannersCarouselModalScreen`) so a screen that
// doesn't need the carousel doesn't pull it into its bundle graph either.
export * from './components/HomeBannersStrip'
// `animations` (useBannerReveal) has no react-native-pager-view dependency, so
// it is safe to re-export here — see the bundle-leak note above.
export * from './components/animations'
export * from './hooks'
