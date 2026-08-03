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

import { type NativeStackNavigationOptions } from '@react-navigation/native-stack'

export const CHART_FOCUS_DEBOUNCE_TIME = 200
export const CHART_HEIGHT = 140
export const CHART_ANIMATION_DURATION = 200

export const BOTTOM_TAB_HEIGHT_IOS = 40
export const BOTTOM_TAB_HEIGHT_ANDROID = 55
export const BOTTOM_TAB_LABEL_FONT_SIZE = 11
export const BOTTOM_TAB_LABEL_LINE_HEIGHT = 14

const SCREEN_ANIMATION_TYPE = 'default'
export const SCREEN_ANIMATION_DURATION_MS = 150
export const SCREEN_ANIMATION_CONFIG: NativeStackNavigationOptions = {
    animation: SCREEN_ANIMATION_TYPE,
    animationDuration: SCREEN_ANIMATION_DURATION_MS,
    statusBarAnimation: 'slide',
}

export const EXPANDABLE_PANEL_ANIMATION_DURATION = 200
export const BACKUP_REMINDER_BANNER_REVEAL_DELAY = 800
export const BACKUP_REMINDER_BANNER_REVEAL_DURATION = 200
export const SLIDE_TO_CONFIRM_ANIMATION_DURATION = 250

// How long the "back online" confirmation stays before auto-dismissing.
export const OFFLINE_RECONNECT_DISPLAY_MS = 3000
// Duration of the offline banner's fade-in animation on mount.
export const OFFLINE_BANNER_FADE_MS = 200
// How long the banner stays emphasized after an action is blocked by being offline.
export const OFFLINE_BANNER_EMPHASIS_MS = 1200
// Peak scale of the attention pulse the banner plays when emphasized.
export const OFFLINE_BANNER_EMPHASIS_SCALE = 1.08
// Duration of each leg (up, then back) of that pulse.
export const OFFLINE_BANNER_EMPHASIS_PULSE_MS = 200

export const SHORT_PROMPT_DISPLAY_DELAY = 300
export const LONG_PROMPT_DISPLAY_DELAY = 3000

export const SEARCH_DEBOUNCE_TIME = 400
export const SEARCH_DEBOUNCE_TIME_SHORT = 75
export const ASSET_LIST_ITEM_MIN_HEIGHT = 64

// Wait after the last amount keystroke before (re-)fetching an onramp quote.
export const ONRAMP_QUOTE_DEBOUNCE_TIME = 500
// Wait before surfacing an inline amount-validation message, so it doesn't
// flash while the user is still typing.
export const ONRAMP_AMOUNT_ERROR_DEBOUNCE_TIME = 300

export const NFT_NOT_OPTED_IN_OPACITY = 0.5

export const SCROLL_EVENT_THROTTLE = 16
export const DEFAULT_SNAP_THRESHOLD = 0.25

export const BANNER_REVEAL_DURATION_MS = 500
// How long to wait after mount before the home / messages banner reveal kicks
// off. Lets the surrounding screen paint first so the animation reads as a
// distinct beat instead of getting lost in the initial render frames.
export const BANNER_REVEAL_DELAY_MS = 500

// Web-only: caps the app's content width on the wide "expanded" browser-tab
// surface (the UI is designed for a 360px popup and looks broken stretched
// edge-to-edge across a full desktop tab). Shared by AppShell.web.tsx (the
// app's own root card) and PWBottomSheet.web.tsx (so sheets, which portal to
// document.body and would otherwise fill the whole viewport, match the same
// card width). Never binds in the popup, which is already narrower than it.
export const WEB_EXPANDED_CARD_MAX_WIDTH = 420
