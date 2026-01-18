const fs = require('fs');
const path = require('path');

// Adjusted paths for root level execution targeting apps/mobile
const LOCALES_DIR = path.join(__dirname, '../apps/mobile/src/i18n/locales');
const SRC_DIR = path.join(__dirname, '../apps/mobile/src');

const EXCLUDED_KEYS = [
    'errors.walletconnect.invalid_network_body',
    'errors.walletconnect.sign_request_body',
    'errors.walletconnect.permission_body',
    'errors.walletconnect.invalid_session_body',
];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
    console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
}

function warn(message) {
    console.warn(`${colors.yellow}WARNING: ${message}${colors.reset}`);
}

function getFiles(dir, exts) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Skip __tests__ directories
        if (file === '__tests__') {
            return;
        }

        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath, exts));
        } else {
            // Check if it's a test file (.spec.ts, .test.ts, etc.)
            const isTestFile =
                file.includes('.spec.') || file.includes('.test.');

            if (exts.includes(path.extname(filePath)) && !isTestFile) {
                results.push(filePath);
            }
        }
    });
    return results;
}

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

function main() {
    log('Starting i18n lint...', colors.blue);

    // 1. Consistency Check
    log('\n--- Checking Locale Consistency ---', colors.blue);

    if (!fs.existsSync(LOCALES_DIR)) {
        error(`Locales directory not found at: ${LOCALES_DIR}`);
        process.exit(1);
    }

    const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
    const locales = {};

    localeFiles.forEach(file => {
        try {
            locales[file] = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
        } catch (e) {
            error(`Failed to parse ${file}: ${e.message}`);
            process.exit(1);
        }
    });

    if (!locales['en.json']) {
        error('en.json not found! It is required as the base locale.');
        process.exit(1);
    }

    const baseKeys = new Set(flattenKeys(locales['en.json']));
    let consistencyIssues = false;

    localeFiles.forEach(file => {
        if (file === 'en.json') return;

        const fileKeys = new Set(flattenKeys(locales[file]));

        // Check for missing keys
        baseKeys.forEach(key => {
            if (!fileKeys.has(key)) {
                warn(`Missing key in ${file}: ${key}`);
                consistencyIssues = true;
            }
        });

        // Check for extra keys
        fileKeys.forEach(key => {
            if (!baseKeys.has(key)) {
                warn(`Extra key in ${file}: ${key} (not in en.json)`);
                consistencyIssues = true;
            }
        });
    });

    if (!consistencyIssues) {
        log('All locales are consistent.', colors.green);
    }

    // 5. Error Keys Check (Verify keys in i18n-keys.ts exist in en.json)
    log('\n--- Checking for Error Keys Coverage ---', colors.blue);
    const ERROR_KEYS_PATH = path.join(__dirname, '../packages/shared/src/errors/i18n-keys.ts');
    let errorKeysCount = 0;
    const errorKeys = new Set();

    if (fs.existsSync(ERROR_KEYS_PATH)) {
        const content = fs.readFileSync(ERROR_KEYS_PATH, 'utf8');
        // Simple regex to find values in the object: KEY: 'value'
        const keyRegex = /[A-Z0-9_]+\s*:\s*['"]([^'"]+)['"]/g;
        let match;

        while ((match = keyRegex.exec(content)) !== null) {
            const key = match[1];
            errorKeys.add(key);
            if (!baseKeys.has(key)) {
                warn(`Error key defined in i18n-keys.ts but missing in en.json: ${key}`);
                errorKeysCount++;
            }
        }
    } else {
        warn(`Could not find i18n-keys.ts at ${ERROR_KEYS_PATH}`);
    }

    if (errorKeysCount === 0) {
        log('All defined error keys are present in en.json.', colors.green);
    }


    // 2. Unused Keys Check
    log('\n--- Checking for Unused Keys ---', colors.blue);
    const srcFiles = getFiles(SRC_DIR, ['.ts', '.tsx']);
    const allCode = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

    let unusedKeysCount = 0;
    baseKeys.forEach(key => {
        // Basic check: looks for the key string in quotes. 
        // This isn't perfect (e.g. dynamic keys) but good for a "lint"
        // We try to match "key" or 'key' or `key`
        const regex = new RegExp(`['"\`]${key}['"\`]`, 'g');
        if (!regex.test(allCode) && !errorKeys.has(key) && !EXCLUDED_KEYS.includes(key)) {
            // Also check if it's used as a translation call like t('key') or t("key") just in case
            // Actually the above quote check covers most simple usages.
            // Let's being conservative and just warn.
            warn(`Potentially unused key: ${key}`);
            unusedKeysCount++;
        }
    });

    if (unusedKeysCount === 0) {
        log('No unused keys found.', colors.green);
    }


    // 3. Missing Keys Check (Keys used in code but missing in en.json)
    log('\n--- Checking for Missing Keys in Code ---', colors.blue);
    let missingKeysCount = 0;
    // Regex to find t('key') or t("key") or t(`key`)
    // We want to capture the content inside the quotes
    const tCallRegex = /\bt\s*\(\s*(['"`])(.*?)\1\s*\)/g;

    srcFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(process.cwd(), file);
        let match;
        while ((match = tCallRegex.exec(content)) !== null) {
            const key = match[2];
            if (!baseKeys.has(key)) {
                warn(`Missing key used in ${relativePath}: ${key}`);
                missingKeysCount++;
            }
        }
    });

    if (missingKeysCount === 0) {
        log('No missing keys found in code.', colors.green);
    }


    // 4. Un-internationalized Strings Check
    log('\n--- Checking for Un-internationalized Strings ---', colors.blue);
    let hardcodedStringsCount = 0;

    // Regex patterns to look for potential issues
    // <Text>Something</Text> -> matches content between tags that looks like text
    // title="Something"
    // body="Something"
    // placeholder="Something"

    const patterns = [
        { name: 'Hardcoded Text Component', regex: /<Text[^>]*>([^<{]+)<\/Text>/g },
        { name: 'Hardcoded title prop', regex: /title=['"]([^'"{}]*)['"]/g },
        { name: 'Hardcoded body prop', regex: /body=['"]([^'"{}]*)['"]/g },
        { name: 'Hardcoded placeholder prop', regex: /placeholder=['"]([^'"{}]*)['"]/g },
        { name: 'Hardcoded label prop', regex: /label=['"]([^'"{}]*)['"]/g },
    ];

    srcFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(process.cwd(), file);

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.regex.exec(content)) !== null) {
                const text = match[1].trim();
                // Ignore obviously non-text things (empty, numbers, symbols only)
                if (text && !/^[0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/.test(text)) {
                    warn(`${pattern.name} in ${relativePath}: "${text}"`);
                    hardcodedStringsCount++;
                }
            }
        });
    });

    if (hardcodedStringsCount === 0) {
        log('No obvious hardcoded strings found.', colors.green);
    }

    log('\nDone.', colors.blue);
}

main();
