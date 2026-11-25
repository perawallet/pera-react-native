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

module.exports = {
  project: {
    ios: {
      sourceDir: './ios',
      automaticPodsInstallation: true,
    },
    android: {},
  },
  assets: ['./assets/fonts'],
  dependencies: {
    // iOS scans with vision-camera's AVFoundation object output instead. ML Kit's
    // pods bring CocoaPods copies of GoogleUtilities/GoogleDataTransport that
    // duplicate Firebase's SPM ones, and have no arm64-simulator slice.
    'react-native-vision-camera-barcode-scanner': {
      platforms: { ios: null },
    },
  },
};