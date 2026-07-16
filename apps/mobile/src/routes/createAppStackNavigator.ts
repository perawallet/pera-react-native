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

// Native passthrough: page navigators use native-stack exactly as before. The
// web sibling (createAppStackNavigator.web.ts) swaps in the JS stack so screen
// transitions animate on web, where native-stack renders an instant toggle.
export { createNativeStackNavigator as createAppStackNavigator } from '@react-navigation/native-stack'
