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

/**
 * Entry point of the on-device benchmark app. Metro resolves it in place of
 * entry.native.js when BENCH=1 (see metro.config.js).
 *
 * Keep the side-effect imports in step with entry.native.js: the benchmarks
 * must run on the same polyfills the shipped app does.
 */

import './shim'
import '@walletconnect/react-native-compat'
import './src/wdyr'
import 'fast-text-encoding'

import { registerRootComponent } from 'expo'
import { BenchApp } from '@perawallet/benchmarks'
import { initRuntime } from './src/bootstrap/preReact'

initRuntime()

registerRootComponent(BenchApp)
