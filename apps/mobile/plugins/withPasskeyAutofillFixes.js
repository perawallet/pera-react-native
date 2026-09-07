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

/* eslint-disable @typescript-eslint/no-require-imports */
const { withProjectBuildGradle, withXcodeProject } = require('expo/config-plugins');

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 *
 * ============================================================================
 * TEMPORARY WORKAROUNDS for @algorandfoundation/react-native-passkey-autofill
 * ----------------------------------------------------------------------------
 * The module's native iOS/Android integration is WIP (canary.16) and its
 * config plugin produces a project that doesn't build as-is. This bundles
 * every local fix in one place — DELETE THIS WHOLE PLUGIN (and its single
 * `app.config.js` entry) once the upstream package ships the fixes:
 *
 *   1. [Android] The vendored DP256 AAR lives in a local Maven repo
 *      (`android/libs/repo`) declared only inside the module's own
 *      build.gradle, so consumers can't resolve `co.algorand:dP256Android`.
 *      → Register that repo at the `allprojects` level.
 *
 *   2. [iOS] The credential-provider extension target's `DEVELOPMENT_TEAM` is
 *      written unquoted; when no team id is supplied it falls back to the
 *      literal `$(DEVELOPMENT_TEAM)`, whose parens make the pbxproj unparseable
 *      ("Dictionary missing ';' after key-value pair").
 *      → Quote any unquoted `$(...)` value.
 *
 *   3. [iOS] The app embeds the extension's `.appex` but declares no target
 *      dependency on the extension, so Xcode reports "Cycle inside <app>". The
 *      plugin also adds the extension's shared `.mm` to Sources twice.
 *      → Add the app→extension target dependency and de-dupe Sources phases.
 *
 *   4. [iOS] The plugin appends the appex "Copy Files" (embed) phase as the
 *      LAST build phase — after the RNFirebase script phases. Those scripts
 *      depend on the whole `<app>.app` tree (Info.plist) and the embed writes
 *      into that same tree (`<app>.app/PlugIns`), so the embed ends up ordered
 *      after a script that in turn depends on the embed's output → still
 *      "Cycle inside <app>" even with the target dependency in place.
 *      → Move the appex embed phase ahead of the bundle-touching script phases
 *        (the standard "Embed App Extensions" position, right after framework
 *        embedding).
 *
 * MUST be registered AFTER the autofill plugin so it operates on the project
 * that plugin produced.
 * ============================================================================
 */
const withPasskeyAutofillFixes = (config) => {
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addAndroidMavenRepo(
        config.modResults.contents,
      );
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    applyIosFixes(config.modResults);
    return config;
  });

  return config;
};

// --- [Android] DP256 vendored Maven repo -----------------------------------

const ANDROID_MAVEN_REPO =
  'maven { url "$rootDir/../node_modules/@algorandfoundation/react-native-passkey-autofill/android/libs/repo" }';

function addAndroidMavenRepo(buildGradle) {
  if (buildGradle.includes(ANDROID_MAVEN_REPO)) {
    return buildGradle;
  }
  return buildGradle.replace(
    /allprojects\s*{\s*repositories\s*{/,
    `allprojects {
    repositories {
        ${ANDROID_MAVEN_REPO}`,
  );
}

// --- [iOS] pbxproj fixes ----------------------------------------------------

const EXTENSION_TARGET_NAME = 'PasskeyAutofillCredentialProvider';

const unquote = (value) => (value || '').replace(/"/g, '');

/**
 * Applies the iOS pbxproj fixes to a parsed `xcode` project. Exported so a
 * one-off script can repair an already-generated `project.pbxproj` without a
 * full prebuild.
 *
 * @param {import('xcode').XcodeProject} project
 */
function applyIosFixes(project) {
  quoteDevelopmentTeam(project);
  addExtensionTargetDependency(project);
  dedupeSourcesBuildPhases(project);
  moveExtensionEmbedBeforeBundleScripts(project);
}

/** Quote any unquoted `$(...)` DEVELOPMENT_TEAM so the pbxproj parses. */
function quoteDevelopmentTeam(project) {
  const section = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(section)) {
    const settings = section[key] && section[key].buildSettings;
    const team = settings && settings.DEVELOPMENT_TEAM;
    if (
      typeof team === 'string' &&
      team.includes('$(') &&
      !team.startsWith('"')
    ) {
      settings.DEVELOPMENT_TEAM = `"${team}"`;
    }
  }
}

/** Add the missing app→extension target dependency (breaks the build cycle). */
function addExtensionTargetDependency(project) {
  const nativeTargets = project.pbxNativeTargetSection();

  let appUuid;
  let extensionUuid;
  for (const uuid of Object.keys(nativeTargets)) {
    if (uuid.endsWith('_comment')) continue;
    const target = nativeTargets[uuid];
    if (!target || typeof target !== 'object') continue;
    if (unquote(target.productType) === 'com.apple.product-type.application') {
      appUuid = uuid;
    }
    if (unquote(target.name) === EXTENSION_TARGET_NAME) {
      extensionUuid = uuid;
    }
  }

  if (!appUuid || !extensionUuid || dependsOn(project, extensionUuid)) {
    return;
  }

  // xcode@3's `addTargetDependency` only writes when the PBXTargetDependency
  // and PBXContainerItemProxy sections already exist (it doesn't create them)
  // — and a project with no inter-target deps has neither, so the call
  // silently no-ops. Seed both sections first.
  const objects = project.hash.project.objects;
  if (typeof objects.PBXTargetDependency !== 'object') {
    objects.PBXTargetDependency = {};
  }
  if (typeof objects.PBXContainerItemProxy !== 'object') {
    objects.PBXContainerItemProxy = {};
  }
  project.addTargetDependency(appUuid, [extensionUuid]);
}

/** True when any PBXTargetDependency already points at the given target. */
function dependsOn(project, targetUuid) {
  const deps = project.hash.project.objects.PBXTargetDependency || {};
  return Object.keys(deps).some(
    (key) => !key.endsWith('_comment') && deps[key]?.target === targetUuid,
  );
}

const FRAMEWORK_EMBED_PHASE_NAME = '[CP] Embed Pods Frameworks';

/**
 * Moves the appex embed ("Copy Files" → PlugIns) phase ahead of the app's
 * bundle-touching script phases. The autofill plugin appends it last (after
 * the RNFirebase scripts), which closes a build-graph cycle because those
 * scripts depend on the whole `<app>.app` tree that the embed writes into.
 * Re-positioning it right after framework embedding (the standard "Embed App
 * Extensions" slot) makes the ordering linear again.
 */
function moveExtensionEmbedBeforeBundleScripts(project) {
  const nativeTargets = project.pbxNativeTargetSection();
  let appTarget;
  for (const uuid of Object.keys(nativeTargets)) {
    if (uuid.endsWith('_comment')) continue;
    const target = nativeTargets[uuid];
    if (
      target &&
      typeof target === 'object' &&
      unquote(target.productType) === 'com.apple.product-type.application'
    ) {
      appTarget = target;
      break;
    }
  }
  if (!appTarget || !Array.isArray(appTarget.buildPhases)) return;

  // Locate the appex embed phase: a Copy Files phase targeting PlugIns
  // (dstSubfolderSpec 13) that contains a `.appex`.
  const copyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  let appexPhaseUuid;
  for (const uuid of Object.keys(copyPhases)) {
    if (uuid.endsWith('_comment')) continue;
    const phase = copyPhases[uuid];
    if (!phase || typeof phase !== 'object') continue;
    const isPlugins = String(phase.dstSubfolderSpec) === '13';
    const hasAppex =
      Array.isArray(phase.files) &&
      phase.files.some((file) => (file.comment || '').includes('.appex'));
    if (isPlugins && hasAppex) {
      appexPhaseUuid = uuid;
      break;
    }
  }
  if (!appexPhaseUuid) return;

  const phases = appTarget.buildPhases;
  const appexIdx = phases.findIndex((p) => p.value === appexPhaseUuid);
  if (appexIdx === -1) return;

  // Insert right after framework embedding; fall back to right after the
  // Resources phase if that phase isn't present.
  let anchorIdx = phases.findIndex(
    (p) => p.comment === FRAMEWORK_EMBED_PHASE_NAME,
  );
  if (anchorIdx === -1) {
    const resourcesSection =
      project.hash.project.objects.PBXResourcesBuildPhase || {};
    anchorIdx = phases.findIndex((p) => resourcesSection[p.value]);
  }
  if (anchorIdx === -1 || appexIdx <= anchorIdx + 1) return;

  const [entry] = phases.splice(appexIdx, 1);
  phases.splice(anchorIdx + 1, 0, entry);
}

/** Remove duplicate build-file references within each Sources build phase. */
function dedupeSourcesBuildPhases(project) {
  const phases = project.hash.project.objects.PBXSourcesBuildPhase || {};
  for (const key of Object.keys(phases)) {
    if (key.endsWith('_comment')) continue;
    const phase = phases[key];
    if (!phase || !Array.isArray(phase.files)) continue;
    const seen = new Set();
    phase.files = phase.files.filter((file) => {
      if (seen.has(file.value)) return false;
      seen.add(file.value);
      return true;
    });
  }
}

module.exports = Object.assign(withPasskeyAutofillFixes, { applyIosFixes });
