#!/usr/bin/env node

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

const fs = require('fs');
const path = require('path');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const SRC_DIR = path.join(__dirname, '../apps/mobile/src');

// Alias mappings - order matters (more specific first)
const ALIAS_PATTERNS = [
    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/components\//g, replacement: "from '@components/" },
    { pattern: /from ['"]\.\.\/\.\.\/components\//g, replacement: "from '@components/" },
    { pattern: /from ['"]\.\.\/components\//g, replacement: "from '@components/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/providers\//g, replacement: "from '@providers/" },
    { pattern: /from ['"]\.\.\/\.\.\/providers\//g, replacement: "from '@providers/" },
    { pattern: /from ['"]\.\.\/providers\//g, replacement: "from '@providers/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/routes\//g, replacement: "from '@routes/" },
    { pattern: /from ['"]\.\.\/\.\.\/routes\//g, replacement: "from '@routes/" },
    { pattern: /from ['"]\.\.\/routes\//g, replacement: "from '@routes/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/hooks\//g, replacement: "from '@hooks/" },
    { pattern: /from ['"]\.\.\/\.\.\/hooks\//g, replacement: "from '@hooks/" },
    { pattern: /from ['"]\.\.\/hooks\//g, replacement: "from '@hooks/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/constants\//g, replacement: "from '@constants/" },
    { pattern: /from ['"]\.\.\/\.\.\/constants\//g, replacement: "from '@constants/" },
    { pattern: /from ['"]\.\.\/constants\//g, replacement: "from '@constants/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/modules\//g, replacement: "from '@modules/" },
    { pattern: /from ['"]\.\.\/\.\.\/modules\//g, replacement: "from '@modules/" },
    { pattern: /from ['"]\.\.\/modules\//g, replacement: "from '@modules/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/theme\//g, replacement: "from '@theme/" },
    { pattern: /from ['"]\.\.\/\.\.\/theme\//g, replacement: "from '@theme/" },
    { pattern: /from ['"]\.\.\/theme\//g, replacement: "from '@theme/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/layouts\//g, replacement: "from '@layouts/" },
    { pattern: /from ['"]\.\.\/\.\.\/layouts\//g, replacement: "from '@layouts/" },
    { pattern: /from ['"]\.\.\/layouts\//g, replacement: "from '@layouts/" },

    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/assets\//g, replacement: "from '@assets/" },
    { pattern: /from ['"]\.\.\/\.\.\/\.\.\/assets\//g, replacement: "from '@assets/" },
    { pattern: /from ['"]\.\.\/\.\.\/assets\//g, replacement: "from '@assets/" },
    { pattern: /from ['"]\.\.\/assets\//g, replacement: "from '@assets/" },

    // Also handle platform imports (since it's in src but we don't have an alias)
    // We'll leave these as relative for now
];

// Statistics
let stats = {
    filesProcessed: 0,
    filesModified: 0,
    importsReplaced: 0,
};

/**
 * Get all TypeScript/TSX files in a directory recursively
 */
function getTypeScriptFiles(dir) {
    const files = [];

    function traverse(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                // Skip node_modules, test directories, etc.
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    traverse(fullPath);
                }
            } else if (entry.isFile()) {
                if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
                    files.push(fullPath);
                }
            }
        }
    }

    traverse(dir);
    return files;
}

/**
 * Process a single file
 */
function processFile(filePath) {
    stats.filesProcessed++;

    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let replacementCount = 0;

    // Apply all alias patterns
    for (const { pattern, replacement } of ALIAS_PATTERNS) {
        const matches = modifiedContent.match(pattern);
        if (matches) {
            replacementCount += matches.length;
            modifiedContent = modifiedContent.replace(pattern, replacement);
        }
    }

    // If content changed, write it back (unless dry run)
    if (modifiedContent !== content) {
        stats.filesModified++;
        stats.importsReplaced += replacementCount;

        if (VERBOSE || DRY_RUN) {
            console.log(`\n📝 ${path.relative(process.cwd(), filePath)}`);
            console.log(`   Replaced ${replacementCount} import(s)`);
        }

        if (!DRY_RUN) {
            fs.writeFileSync(filePath, modifiedContent, 'utf8');
        }
    }
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Replacing relative imports with path aliases...\n');

    if (DRY_RUN) {
        console.log('🏃 DRY RUN MODE - No files will be modified\n');
    }

    // Get all TypeScript files
    const files = getTypeScriptFiles(SRC_DIR);
    console.log(`Found ${files.length} TypeScript/TSX files\n`);

    // Process each file
    for (const file of files) {
        processFile(file);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Files processed:  ${stats.filesProcessed}`);
    console.log(`Files modified:   ${stats.filesModified}`);
    console.log(`Imports replaced: ${stats.importsReplaced}`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('\n💡 Run without --dry-run to apply changes');
    } else {
        console.log('\n✅ Replacement complete!');
        console.log('💡 Review changes with: git diff');
        console.log('💡 Verify with: pnpm test && pnpm lint');
    }
}

// Run the script
main();
