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

/**
 * @format
 * Entry point for Expo-based React Native app
 */



// Crypto and other polyfills
import './shim'

// Development tooling
import './src/wdyr'

// Text encoding polyfill
import 'fast-text-encoding'

// Expo registration (replaces AppRegistry.registerComponent)
import { registerRootComponent } from 'expo'
import { AppRegistry } from 'react-native'
import { App } from './src/App'
import { AutofillPickerRoot } from './src/modules/passwords/AutofillPickerRoot'
import AUTOFILL_PICKER_COMPONENT from './autofill-picker-component'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)

// The autofill picker activity mounts this by name, read from manifest
// meta-data before any JS has run — nothing here can negotiate it, so the
// name is shared with the config rather than repeated.
AppRegistry.registerComponent(AUTOFILL_PICKER_COMPONENT, () => AutofillPickerRoot)
