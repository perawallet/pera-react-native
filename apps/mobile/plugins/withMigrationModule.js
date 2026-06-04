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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const MIGRATION_GROUP_NAME = 'Migration';
const SOURCE_DIR_REL_TO_PROJECT = 'migration-ios';
const SQLITE3_BRIDGING_LINE = '#import <sqlite3.h>';
const SOURCE_EXTENSIONS = ['.swift', '.m'];

const isMigrationSource = (filename) =>
  SOURCE_EXTENSIONS.some((ext) => filename.endsWith(ext));

// eslint-disable-next-line no-console
const warn = (msg) => console.warn(`[withMigrationModule] ${msg}`);

const collectSourceFilesRecursive = (root) => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && isMigrationSource(entry.name)) files.push(abs);
    }
  };
  walk(root);
  return files;
};

const assertUniqueBasenames = (filePaths) => {
  const seen = new Map();
  for (const abs of filePaths) {
    const name = path.basename(abs);
    const previous = seen.get(name);
    if (previous) {
      throw new Error(
        `[withMigrationModule] duplicate source basename "${name}" — ` +
          `found at ${previous} and ${abs}. The plugin flattens ` +
          `subdirectories into a single Xcode group, so basenames must be unique.`,
      );
    }
    seen.set(name, abs);
  }
};

const copyFilesFlat = (filePaths, destDirAbs) => {
  for (const abs of filePaths) {
    fs.copyFileSync(abs, path.join(destDirAbs, path.basename(abs)));
  }
};

// A bridging-header `#import <sqlite3.h>` must NOT be present: it resolves ambiguously against expo-sqlite's vendored header, breaking `sqlite3_*` calls. Strip it if present.
const removeSqlite3ImportIfPresent = (bridgingHeaderAbs) => {
  let current;
  try {
    current = fs.readFileSync(bridgingHeaderAbs, 'utf8');
  } catch (error) {
    // ENOENT: bridging header doesn't exist yet — nothing to strip. Re-throw anything else.
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (!current.includes(SQLITE3_BRIDGING_LINE)) return;
  const stripped = current
    .split('\n')
    .filter((line) => line.trim() !== SQLITE3_BRIDGING_LINE)
    .join('\n');
  fs.writeFileSync(bridgingHeaderAbs, `${stripped.trimEnd()}\n`, 'utf8');
};

const copyMigrationSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName: targetName } =
        config.modRequest;
      const sourceDirAbs = path.join(projectRoot, SOURCE_DIR_REL_TO_PROJECT);
      const destDirAbs = path.join(
        platformProjectRoot,
        targetName,
        MIGRATION_GROUP_NAME,
      );

      if (!fs.existsSync(sourceDirAbs)) {
        warn(
          `canonical source dir "${SOURCE_DIR_REL_TO_PROJECT}/" not found — skipping copy.`,
        );
        return config;
      }

      fs.mkdirSync(destDirAbs, { recursive: true });
      const sourceFiles = collectSourceFilesRecursive(sourceDirAbs);
      assertUniqueBasenames(sourceFiles);
      copyFilesFlat(sourceFiles, destDirAbs);

      removeSqlite3ImportIfPresent(
        path.join(platformProjectRoot, targetName, `${targetName}-Bridging-Header.h`),
      );

      return config;
    },
  ]);

const getPbxGroups = (proj) => proj.hash.project.objects.PBXGroup;

const findGroupKeyMatching = (proj, predicate) => {
  const groups = getPbxGroups(proj);
  for (const key of Object.keys(groups)) {
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (group && typeof group === 'object' && predicate(group, key)) return key;
  }
  return null;
};

const findChildGroupKey = (proj, parentKey, groupName) => {
  const parent = getPbxGroups(proj)[parentKey];
  if (!parent || !Array.isArray(parent.children)) return null;
  for (const child of parent.children) {
    const childGroup = getPbxGroups(proj)[child.value];
    if (
      childGroup &&
      (childGroup.name === groupName || childGroup.path === groupName)
    ) {
      return child.value;
    }
  }
  return null;
};

const findTargetOrThrow = (proj, targetName) => {
  const target = proj.pbxTargetByName(targetName);
  if (!target) {
    throw new Error(
      `[withMigrationModule] target "${targetName}" not found in Xcode project`,
    );
  }
  return target;
};

const findParentGroupKeyOrThrow = (proj, targetName) => {
  const key = findGroupKeyMatching(
    proj,
    (g) => g.name === targetName || g.path === targetName,
  );
  if (!key) {
    throw new Error(
      `[withMigrationModule] parent group "${targetName}" not found`,
    );
  }
  return key;
};

const ensureMigrationGroup = (proj, parentKey) => {
  const existing = findChildGroupKey(proj, parentKey, MIGRATION_GROUP_NAME);
  if (existing) return existing;
  const { uuid } = proj.addPbxGroup([], MIGRATION_GROUP_NAME, null);
  getPbxGroups(proj)[parentKey].children.push({
    value: uuid,
    comment: MIGRATION_GROUP_NAME,
  });
  return uuid;
};

const addNewSourceFilesToTarget = (proj, target, groupKey, dirAbs, projectRelDir) => {
  const filenames = fs.readdirSync(dirAbs).filter(isMigrationSource).sort();
  for (const filename of filenames) {
    const projectRelPath = `${projectRelDir}/${filename}`;
    if (proj.hasFile(projectRelPath)) continue;
    proj.addSourceFile(projectRelPath, { target: target.uuid }, groupKey);
  }
};

const registerMigrationSources = (config) =>
  withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const { platformProjectRoot, projectName: targetName } = config.modRequest;
    const projectRelDir = `${targetName}/${MIGRATION_GROUP_NAME}`;
    const dirAbs = path.join(platformProjectRoot, projectRelDir);

    if (!fs.existsSync(dirAbs)) {
      warn(
        `${projectRelDir} does not exist on disk; pbxproj registration skipped.`,
      );
      return config;
    }

    const target = findTargetOrThrow(proj, targetName);
    const parentKey = findParentGroupKeyOrThrow(proj, targetName);
    const migrationGroupKey = ensureMigrationGroup(proj, parentKey);

    delete getPbxGroups(proj)[migrationGroupKey].path;

    addNewSourceFilesToTarget(
      proj,
      target,
      migrationGroupKey,
      dirAbs,
      projectRelDir,
    );

    return config;
  });

const withMigrationModule = (config) =>
  registerMigrationSources(copyMigrationSources(config));

module.exports = withMigrationModule;
