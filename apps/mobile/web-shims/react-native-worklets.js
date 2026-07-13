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

// Web shim for react-native-worklets.
// The real package calls installWorkletsSupport() at module-eval time which
// requires react-native's NativeModules bridge — unavailable in browser
// environments (throws __fbBatchedBridgeConfig). Worklets run on native JS
// runtimes (Hermes/V8); on web react-native-reanimated falls back to CSS
// animations so the worklet runtime is never needed.

const noop = () => undefined
const identity = (val) => val
const noopFn = (fn) => fn

// Named exports matching the full react-native-worklets public surface.
// Thread scheduling — run immediately on web (single-threaded environment).
export const scheduleOnRN = (fn) => { fn() }
export const scheduleOnUI = (fn) => { fn() }
export const scheduleOnRuntime = (_, fn) => { fn() }
export const scheduleOnRuntimeWithId = (_, __, fn) => { fn() }
export const runOnJS = noopFn
export const runOnUI = noopFn
export const runOnUISync = noopFn
export const runOnUIAsync = (fn) => Promise.resolve(fn())
export const runOnRuntimeAsync = (_, fn) => Promise.resolve(fn())
export const runOnRuntimeAsyncWithId = (_, __, fn) => Promise.resolve(fn())
export const runOnRuntimeSync = (_, fn) => fn()
export const runOnRuntimeSyncWithId = (_, __, fn) => fn()
export const executeOnUIRuntimeSync = (fn) => fn()
// Shareable memory — on web objects are passed by reference directly.
export const makeShareable = identity
export const makeShareableCloneOnUIRecursive = identity
export const makeShareableCloneRecursive = identity
export const createShareable = identity
export const isShareable = () => false
export const isShareableRef = () => false
export const shareableMappingCache = { has: () => false, set: noop, get: () => undefined }
// Serializable — lightweight wrappers used by reanimated's layout animations.
export const createSerializable = (val) => ({ current: val !== undefined ? val : null })
export const isSerializableRef = () => false
export const registerCustomSerializable = noop
export const serializableMappingCache = { has: () => false, set: noop, get: () => undefined }
// Synchronizable
export const createSynchronizable = identity
export const isSynchronizable = () => false
// Feature flags
export const getDynamicFeatureFlag = () => false
export const getStaticFeatureFlag = () => false
export const setDynamicFeatureFlag = noop
// Debug / bundle mode
export const isBundleModeEnabled = () => false
export const toggleSlowAnimationsOnUIRuntime = noop
export const callMicrotasks = noop
// Runtime kind
export const getRuntimeKind = () => 1  // 1 = ReactNative runtime kind (0 is invalid/unset)
export const isRNRuntime = () => true
export const isUIRuntime = () => false
export const isWorkerRuntime = () => false
export const isWorkletRuntime = () => false
export const isWorkletFunction = () => false
export const WorkletsModule = {}
export const UIRuntimeId = 0
// Runtime management
export const createWorkletRuntime = noop
export const getUIRuntimeHolder = () => null
export const getUISchedulerHolder = () => null
