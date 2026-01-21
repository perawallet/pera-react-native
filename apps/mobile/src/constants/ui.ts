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

export const TAB_ANIMATION_DURATION = 200
export const TAB_ANIMATION_CONFIG = {
    duration: TAB_ANIMATION_DURATION,
    useNativeDriver: true,
}

export const SCREEN_ANIMATION_TYPE = 'default'
export const SCREEN_ANIMATION_DURATION = 150
export const SCREEN_ANIMATION_CONFIG: NativeStackNavigationOptions = {
    animation: SCREEN_ANIMATION_TYPE,
    animationDuration: SCREEN_ANIMATION_DURATION,
    statusBarAnimation: 'slide',
}

export const EXPANDABLE_PANEL_ANIMATION_DURATION = 200
export const LONG_NOTIFICATION_DURATION = 5000

export const PROMPT_DISPLAY_DELAY = 3000
