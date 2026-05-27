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

import { NativeStackNavigationOptions } from '@react-navigation/native-stack'

export const CHART_FOCUS_DEBOUNCE_TIME = 200
export const CHART_HEIGHT = 140
export const CHART_ANIMATION_DURATION = 200

export const BOTTOM_TAB_HEIGHT_IOS = 40
export const BOTTOM_TAB_HEIGHT_ANDROID = 55
export const BOTTOM_TAB_LABEL_FONT_SIZE = 11
export const BOTTOM_TAB_LABEL_LINE_HEIGHT = 14

const SCREEN_ANIMATION_TYPE = 'default'
const SCREEN_ANIMATION_DURATION = 150
export const SCREEN_ANIMATION_CONFIG: NativeStackNavigationOptions = {
    animation: SCREEN_ANIMATION_TYPE,
    animationDuration: SCREEN_ANIMATION_DURATION,
    statusBarAnimation: 'slide',
}

export const EXPANDABLE_PANEL_ANIMATION_DURATION = 200
export const BACKUP_REMINDER_BANNER_REVEAL_DELAY = 800
export const BACKUP_REMINDER_BANNER_REVEAL_DURATION = 200
export const SLIDE_TO_CONFIRM_ANIMATION_DURATION = 250
export const LONG_NOTIFICATION_DURATION = 5000

export const SHORT_PROMPT_DISPLAY_DELAY = 300
export const LONG_PROMPT_DISPLAY_DELAY = 3000

export const LONG_ADDRESS_FORMAT = 20

export const SEARCH_DEBOUNCE_TIME = 400
export const SEARCH_DEBOUNCE_TIME_SHORT = 75
export const ASSET_LIST_ITEM_MIN_HEIGHT = 64

export const NFT_NOT_OPTED_IN_OPACITY = 0.5

export const SCROLL_EVENT_THROTTLE = 16
export const DEFAULT_SNAP_THRESHOLD = 0.25

export const BANNER_REVEAL_DURATION_MS = 500
// How long to wait after mount before the home / messages banner reveal kicks
// off. Lets the surrounding screen paint first so the animation reads as a
// distinct beat instead of getting lost in the initial render frames.
export const BANNER_REVEAL_DELAY_MS = 500
