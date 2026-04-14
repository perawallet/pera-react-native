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

/*
 * Enables the SQLite math extension (pow, log, exp, ...) on the sqlite3
 * library used by expo-sqlite. The repository layer relies on `pow()` for
 * in-SQL portfolio aggregation, which is otherwise unavailable because
 * expo-sqlite builds its sqlite without `SQLITE_ENABLE_MATH_FUNCTIONS`.
 *
 * iOS: expo-sqlite pulls in the `sqlite3` CocoaPod, which does NOT expose
 * a property for custom compile flags. We inject a `post_install` hook
 * that appends the preprocessor define to the sqlite3 target's
 * OTHER_CFLAGS build setting.
 *
 * Android: expo-sqlite's own `android/build.gradle` reads
 * `expo.sqlite.customBuildFlags` from `gradle.properties` and forwards it
 * to CMake as `SQLITE_BUILDFLAGS`, so we only need to set that property.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  withPodfile,
  withGradleProperties,
} = require('@expo/config-plugins');

const MATH_FLAG = '-DSQLITE_ENABLE_MATH_FUNCTIONS=1';

const POST_INSTALL_SNIPPET = `
    # Enable SQLite math functions (pow, log, etc.) on the sqlite3 pod used by expo-sqlite.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'sqlite3'
      target.build_configurations.each do |build_config|
        existing = build_config.build_settings['OTHER_CFLAGS']
        flags = case existing
                when nil then ['$(inherited)']
                when Array then existing.dup
                else [existing]
                end
        unless flags.any? { |f| f.to_s.include?('SQLITE_ENABLE_MATH_FUNCTIONS') }
          flags << '${MATH_FLAG}'
        end
        build_config.build_settings['OTHER_CFLAGS'] = flags
      end
    end
`;

const withIosSQLiteMathFunctions = (config) =>
  withPodfile(config, async (podfileConfig) => {
    let contents = podfileConfig.modResults.contents;

    if (contents.includes('SQLITE_ENABLE_MATH_FUNCTIONS')) {
      return podfileConfig;
    }

    // Inject the tweak into the existing `react_native_post_install(...)`
    // block so it runs after RN wires up its own settings.
    const reactNativePostInstall = /(react_native_post_install\([\s\S]*?\)\s*\n)/;
    if (!reactNativePostInstall.test(contents)) {
      throw new Error(
        'withSQLiteMathFunctions: could not locate `react_native_post_install(...)` in the Podfile to attach the math-flag injection.'
      );
    }

    contents = contents.replace(
      reactNativePostInstall,
      `$1${POST_INSTALL_SNIPPET}`
    );

    podfileConfig.modResults.contents = contents;
    return podfileConfig;
  });

const withAndroidSQLiteMathFunctions = (config) =>
  withGradleProperties(config, (gradleConfig) => {
    const key = 'expo.sqlite.customBuildFlags';
    const existing = gradleConfig.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );

    if (existing) {
      if (!String(existing.value).includes('SQLITE_ENABLE_MATH_FUNCTIONS')) {
        existing.value = `${existing.value} ${MATH_FLAG}`.trim();
      }
      return gradleConfig;
    }

    gradleConfig.modResults.push({
      type: 'property',
      key,
      value: MATH_FLAG,
    });
    return gradleConfig;
  });

const withSQLiteMathFunctions = (config) => {
  config = withIosSQLiteMathFunctions(config);
  config = withAndroidSQLiteMathFunctions(config);
  return config;
};

module.exports = withSQLiteMathFunctions;
