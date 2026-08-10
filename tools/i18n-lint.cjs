const fs = require('fs')
const path = require('path')

// Adjusted paths for root level execution targeting apps/mobile
const LOCALES_DIR = path.join(__dirname, '../apps/mobile/src/i18n/locales')
const SRC_DIR = path.join(__dirname, '../apps/mobile/src')
const REPO_ROOT = path.join(__dirname, '..')

// Workspace roots whose `<member>/src` trees can claim a key. `messageKey`
// literals live in packages/*/src/errors.ts and extensions/*/src/errors.ts, so
// scanning apps/mobile alone reports every messageKey-only key as unused.
const WORKSPACE_ROOTS = ['apps', 'packages', 'extensions']

const EXCLUDED_KEYS = [
    'transactions.common.completed',
    'transactions.common.failed',
    'transactions.common.pending',
    'transactions.type.pay',
    'transactions.type.keyreg',
    'transactions.type.acfg',
    'transactions.type.axfer',
    'transactions.type.afrz',
    'transactions.type.appl',
    'transactions.type.stpf',
    'transactions.type.hb',
    'transactions.type.unknown',
]

// Path fragments excluded from the (advisory) hardcoded-string scan below.
// Developer-only surfaces — the in-app dev menu, migration viewer/simulator, and
// the component gallery catalog — are never shipped to users or localized, so
// English literals there are intentional, not i18n gaps. Real user-facing screens
// (e.g. modules/migration/screens/MigrationSplashScreen) are NOT excluded.
const HARDCODED_STRING_IGNORE = ['modules/settings/screens/developer/']

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
}

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`)
}

function error(message) {
    console.error(`${colors.red}ERROR: ${message}${colors.reset}`)
}

function warn(message) {
    console.warn(`${colors.yellow}WARNING: ${message}${colors.reset}`)
}

// Every `<root>/<member>/src` tree in the workspace, one level deep to match
// the pnpm-workspace.yaml globs.
function getWorkspaceSrcFiles(exts) {
    const results = []
    WORKSPACE_ROOTS.forEach(root => {
        const rootPath = path.join(REPO_ROOT, root)
        if (!fs.existsSync(rootPath)) return
        fs.readdirSync(rootPath).forEach(member => {
            const srcPath = path.join(rootPath, member, 'src')
            if (!fs.existsSync(srcPath)) return
            results.push(...getFiles(srcPath, exts))
        })
    })
    return results
}

function getFiles(dir, exts) {
    let results = []
    const list = fs.readdirSync(dir)
    list.forEach(file => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)

        // Skip __tests__ directories
        if (file === '__tests__') {
            return
        }

        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath, exts))
        } else {
            // Check if it's a test file (.spec.ts, .test.ts, etc.)
            const isTestFile =
                file.includes('.spec.') || file.includes('.test.')

            if (exts.includes(path.extname(filePath)) && !isTestFile) {
                results.push(filePath)
            }
        }
    })
    return results
}

function flattenKeys(obj, prefix = '') {
    let keys = []
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'))
        } else {
            keys.push(prefix + key)
        }
    }
    return keys
}

// i18next plural suffixes
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many']

// Helper to get base key from plural key (e.g., 'foo_one' -> 'foo')
function getBaseKey(key) {
    for (const suffix of PLURAL_SUFFIXES) {
        if (key.endsWith(suffix)) {
            return key.slice(0, -suffix.length)
        }
    }
    return null
}

function main() {
    log('Starting i18n lint...', colors.blue)

    // 1. Consistency Check
    log('\n--- Checking Locale Consistency ---', colors.blue)

    if (!fs.existsSync(LOCALES_DIR)) {
        error(`Locales directory not found at: ${LOCALES_DIR}`)
        process.exit(1)
    }

    const localeFiles = fs
        .readdirSync(LOCALES_DIR)
        .filter(f => f.endsWith('.json'))
    const locales = {}

    localeFiles.forEach(file => {
        try {
            locales[file] = JSON.parse(
                fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'),
            )
        } catch (e) {
            error(`Failed to parse ${file}: ${e.message}`)
            process.exit(1)
        }
    })

    if (!locales['en.json']) {
        error('en.json not found! It is required as the base locale.')
        process.exit(1)
    }

    const baseKeys = new Set(flattenKeys(locales['en.json']))
    let consistencyIssues = false

    localeFiles.forEach(file => {
        if (file === 'en.json') return

        const fileKeys = new Set(flattenKeys(locales[file]))

        // Check for missing keys
        baseKeys.forEach(key => {
            if (!fileKeys.has(key)) {
                warn(`Missing key in ${file}: ${key}`)
                consistencyIssues = true
            }
        })

        // Check for extra keys. How many plural forms a language has is set by
        // CLDR, not by English — pt-BR needs a `_zero` ("0 contas") that English
        // has no category for, and Arabic needs `_two`/`_few`/`_many`. So an
        // extra plural variant is legitimate as long as en.json pluralizes the
        // same base key. Everything else still has to match en.json exactly, and
        // the missing-key check above stays strict either way.
        fileKeys.forEach(key => {
            if (baseKeys.has(key)) return

            const base = getBaseKey(key)
            if (
                base &&
                PLURAL_SUFFIXES.some(suffix => baseKeys.has(`${base}${suffix}`))
            ) {
                return
            }

            warn(`Extra key in ${file}: ${key} (not in en.json)`)
            consistencyIssues = true
        })
    })

    if (!consistencyIssues) {
        log('All locales are consistent.', colors.green)
    }

    // 5. Error Keys Check (Verify keys in i18n-keys.ts exist in en.json)
    log('\n--- Checking for Error Keys Coverage ---', colors.blue)
    const ERROR_KEYS_PATH = path.join(
        __dirname,
        '../packages/shared/src/errors/i18n-keys.ts',
    )
    let errorKeysCount = 0
    const errorKeys = new Set()

    if (fs.existsSync(ERROR_KEYS_PATH)) {
        const content = fs.readFileSync(ERROR_KEYS_PATH, 'utf8')
        // Simple regex to find values in the object: KEY: 'value'
        const keyRegex = /[A-Z0-9_]+\s*:\s*['"]([^'"]+)['"]/g
        let match

        while ((match = keyRegex.exec(content)) !== null) {
            const key = match[1]
            errorKeys.add(key)
            if (!baseKeys.has(key)) {
                warn(
                    `Error key defined in i18n-keys.ts but missing in en.json: ${key}`,
                )
                errorKeysCount++
            }
        }
    }

    if (errorKeysCount === 0) {
        log('All defined error keys are present in en.json.', colors.green)
    }

    // 2. Unused Keys Check
    log('\n--- Checking for Unused Keys ---', colors.blue)
    const srcFiles = getWorkspaceSrcFiles(['.ts', '.tsx'])
    const allCode = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n')

    // Bases of dynamically-built keys, DERIVED from the source rather than
    // hand-listed. This replaces the old EXCLUDED_PREFIXES constant, which had
    // to be maintained by hand, silently masked the drift Phase 1a uncovered,
    // and carried three entries pointing at namespaces that did not exist.
    //
    // Two shapes produce a key no exact-match scan can see:
    //  - a static head:   t(`errors.algod.${code}.title`)     -> 'errors.algod.'
    //  - a variable head: t(`${i18nBaseKey}.expect_${index}`) -> the base
    //    arrives as a literal elsewhere, e.g. i18nBaseKey='rekey.to_standard.intro'
    //
    // The second case is why any literal dot-path claims its descendants at dot
    // boundaries. That also subsumes keysFor('errors.network.timeout'), which
    // expands to `${base}.title` / `${base}.body`.
    // A head may end at `_` as well as `.`: t(`walletconnect.request.networks_${chain}`)
    // builds a leaf by suffix, not by nesting, so a dot-only terminator misses it.
    const templateHeads = [...allCode.matchAll(/`([a-z][\w.]*[._])\$\{/gi)].map(
        match => match[1],
    )
    const literalPaths = new Set(
        [...allCode.matchAll(/['"`]([a-z][\w]*(?:\.[\w]+)+)['"`]/gi)].map(
            match => match[1],
        ),
    )

    const isDynamicallyClaimed = key => {
        if (templateHeads.some(head => key.startsWith(head))) return true
        // Walk the key's ancestors: 'a.b.c' -> 'a.b', 'a'
        const segments = key.split('.')
        for (let i = segments.length - 1; i > 0; i--) {
            if (literalPaths.has(segments.slice(0, i).join('.'))) return true
        }
        return false
    }

    // Helper to check if a key is a plural variant
    const isPluralKey = key =>
        PLURAL_SUFFIXES.some(suffix => key.endsWith(suffix))

    let unusedKeysCount = 0
    baseKeys.forEach(key => {
        // Basic check: looks for the key string in quotes.
        // This isn't perfect (e.g. dynamic keys) but good for a "lint"
        // We try to match "key" or 'key' or `key`
        const regex = new RegExp(`['"\`]${key}['"\`]`, 'g')

        // For plural keys (e.g., 'foo_one', 'foo_other'), also check if the base key is used
        // since i18next allows calling t('foo', {count: n}) which uses foo_one/foo_other
        let isUsed = regex.test(allCode)

        if (!isUsed && isPluralKey(key)) {
            const baseKey = getBaseKey(key)
            if (baseKey) {
                const baseRegex = new RegExp(`['"\`]${baseKey}['"\`]`, 'g')
                isUsed = baseRegex.test(allCode)
            }
        }

        if (
            !isUsed &&
            !errorKeys.has(key) &&
            !EXCLUDED_KEYS.includes(key) &&
            !isDynamicallyClaimed(key)
        ) {
            warn(`Potentially unused key: ${key}`)
            unusedKeysCount++
        }
    })

    if (unusedKeysCount === 0) {
        log('No unused keys found.', colors.green)
    }

    // 2b. Error-key claiming check.
    //
    // Every `errors.*` key must be claimed by a real mechanism: a `messageKey`
    // declaration on an error class, a `keysFor()` base, a literal t('errors…'),
    // or a template head for the dynamically-built namespaces.
    //
    // The unused-key check above already blocks, but it honours EXCLUDED_KEYS
    // and the i18n-keys.ts set as escape hatches. This one deliberately does
    // not: error copy is the surface Phase 1a rewired, and suppressing a
    // stranded error key is exactly the drift that effort exists to prevent.
    // Adding an `errors.*` entry to EXCLUDED_KEYS will fail here.
    log('\n--- Checking Error Keys Are Claimed ---', colors.blue)
    let unclaimedErrorKeysCount = 0
    baseKeys.forEach(key => {
        if (!key.startsWith('errors.')) return

        const isClaimed =
            new RegExp(`['"\`]${key}['"\`]`).test(allCode) ||
            isDynamicallyClaimed(key)

        if (!isClaimed) {
            warn(
                `Unclaimed error key: ${key} — no messageKey, keysFor() base, or t() call resolves to it`,
            )
            unclaimedErrorKeysCount++
        }
    })

    if (unclaimedErrorKeysCount === 0) {
        log('All error keys are claimed.', colors.green)
    }

    // 3. Missing Keys Check (Keys used in code but missing in en.json)
    log('\n--- Checking for Missing Keys in Code ---', colors.blue)
    let missingKeysCount = 0
    // Regex to find t('key') or t("key") or t(`key`) or t(\n\n`key`\n\n)
    // We want to capture the content inside the quotes
    const tCallRegex = /\bt\s*\(\s*(['"`])([^]*?)\1\s*[,)]/g

    // Helper to check if plural variants exist for a key
    const hasPluralVariants = key => {
        return baseKeys.has(`${key}_one`) || baseKeys.has(`${key}_other`)
    }

    srcFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8')
        const relativePath = path.relative(process.cwd(), file)
        let match
        while ((match = tCallRegex.exec(content)) !== null) {
            const key = match[2]
            // Skip dynamic keys that use template literal expressions (${...})
            // These cannot be validated statically
            if (key.includes('${')) {
                continue
            }
            // Check if key exists directly, or if plural variants exist (for i18next pluralization)
            if (!baseKeys.has(key) && !hasPluralVariants(key)) {
                warn(`Missing key used in ${relativePath}: ${key}`)
                missingKeysCount++
            }
        }
    })

    if (missingKeysCount === 0) {
        log('No missing keys found in code.', colors.green)
    }

    // 4. Un-internationalized Strings Check
    log('\n--- Checking for Un-internationalized Strings ---', colors.blue)
    // Mobile-only: this scan looks for JSX text and label/title props, which
    // only exist in the app tree. packages/* hold no user-facing markup.
    const mobileSrcFiles = getFiles(SRC_DIR, ['.ts', '.tsx'])
    let hardcodedStringsCount = 0

    // Regex patterns to look for potential issues
    // <Text>Something</Text> -> matches content between tags that looks like text
    // title="Something"
    // body="Something"
    // placeholder="Something"

    const patterns = [
        {
            name: 'Hardcoded Text Component',
            regex: /<Text[^>]*>([^<{]+)<\/Text>/g,
        },
        { name: 'Hardcoded title prop', regex: /title=['"]([^'"{}]*)['"]/g },
        { name: 'Hardcoded body prop', regex: /body=['"]([^'"{}]*)['"]/g },
        {
            name: 'Hardcoded placeholder prop',
            regex: /placeholder=['"]([^'"{}]*)['"]/g,
        },
        { name: 'Hardcoded label prop', regex: /label=['"]([^'"{}]*)['"]/g },
    ]

    mobileSrcFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8')
        const relativePath = path.relative(process.cwd(), file)
        const normalizedPath = relativePath.split(path.sep).join('/')

        // Skip developer-only screens (intentional English, never localized).
        if (
            HARDCODED_STRING_IGNORE.some(frag => normalizedPath.includes(frag))
        ) {
            return
        }

        patterns.forEach(pattern => {
            let match
            while ((match = pattern.regex.exec(content)) !== null) {
                const text = match[1].trim()
                // Ignore obviously non-text things (empty, numbers, symbols only)
                if (
                    text &&
                    !/^[0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/.test(text)
                ) {
                    warn(`${pattern.name} in ${relativePath}: "${text}"`)
                    hardcodedStringsCount++
                }
            }
        })
    })

    if (hardcodedStringsCount === 0) {
        log('No obvious hardcoded strings found.', colors.green)
    }

    log('\nDone.', colors.blue)

    // Fail the build on deterministic findings so CI actually gates on them.
    // Hardcoded-string detection is a fuzzy heuristic (prone to false positives),
    // so it stays advisory — reported above but never blocking.
    const blockingIssues =
        (consistencyIssues ? 1 : 0) +
        errorKeysCount +
        unusedKeysCount +
        unclaimedErrorKeysCount +
        missingKeysCount

    if (blockingIssues > 0) {
        error(
            `i18n lint failed with ${blockingIssues} blocking issue(s): ` +
                `${unusedKeysCount} unused key(s), ${missingKeysCount} missing key(s), ` +
                `${unclaimedErrorKeysCount} unclaimed error key(s), ` +
                `${errorKeysCount} error-key coverage gap(s), ` +
                `${consistencyIssues ? 'locale inconsistencies' : 'no locale inconsistencies'}. ` +
                `See warnings above.`,
        )
        process.exit(1)
    }
}

main()
