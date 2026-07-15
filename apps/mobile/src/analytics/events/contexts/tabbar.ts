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

/** Lower tab bar presses. One per tab in the RN app. */
export enum TabbarEvent {
    Home = 'lowermenu_home_tap', // Tapped the Home tab
    Discover = 'lowermenu_discover_tap', // Tapped the Discover tab
    Swap = 'lowermenu_swap_tap', // Tapped the Swap tab
    Fund = 'lowermenu_fund_tap', // Tapped the Fund tab
    Menu = 'lowermenu_menu_tap', // Tapped the Menu tab
}
