#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Environment Setup Script
 *
 * This script loads and validates environment variables from Fastlane .env files
 * and makes them available to the React Native build process.
 *
 * Usage: node scripts/setup-env.js <environment>
 * Example: node scripts/setup-env.js staging
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
const environment = process.argv[2]

if (!environment) {
  console.error('Error: Environment argument is required')
  console.error('Usage: node scripts/setup-env.js <environment>')
  console.error('Examples:')
  console.error('  node scripts/setup-env.js staging')
  console.error('  node scripts/setup-env.js production')
  process.exit(1)
}

// Validate environment
const validEnvironments = ['staging', 'production']
if (!validEnvironments.includes(environment)) {
  console.error(`Error: Invalid environment "${environment}"`)
  console.error(`Valid environments: ${validEnvironments.join(', ')}`)
  process.exit(1)
}

// Construct path to env file
const envFilePath = path.join(__dirname, '..', '..', '..', 'fastlane', `.env.${environment}`)

// Check if env file exists
if (!fs.existsSync(envFilePath)) {
  console.error(`Error: Environment file not found: ${envFilePath}`)
  console.error('')
  console.error('To set up the environment file:')
  console.error(`1. Copy the template: cp fastlane/.env.default fastlane/.env.${environment}`)
  console.error(`2. Edit fastlane/.env.${environment} and fill in the values`)
  console.error('3. Run this script again')
  process.exit(1)
}

// Parse .env file (simple parser - supports KEY=VALUE format)
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const env = {}

  for (let line of content.split('\n')) {
    // Skip comments and empty lines
    line = line.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    // Parse KEY=VALUE
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      env[key] = value
    }
  }

  return env
}

// Load environment variables
const envVars = parseEnvFile(envFilePath)

// Required variables for Pera backend configuration
const requiredVars = {
  backend: ['PERA_MAINNET_BACKEND_URL', 'PERA_TESTNET_BACKEND_URL', 'PERA_BACKEND_API_KEY'],
  signing: [],
}

// For staging/production, require backend config
const missingVars = []
for (const varName of requiredVars.backend) {
  if (!envVars[varName] || envVars[varName] === '') {
    missingVars.push(varName)
  }
}

if (missingVars.length > 0) {
  console.error(`Error: Required environment variables are missing or empty in ${envFilePath}:`)
  for (const varName of missingVars) {
    console.error(`  - ${varName}`)
  }
  console.error('')
  console.error('Please edit the environment file and provide these values.')
  process.exit(1)
}

// Set environment variables for the build process
for (const key of Object.keys(envVars)) {
  if (envVars[key]) {
    process.env[key] = envVars[key]
  }
}

// Also set APP_ENV to match the environment
process.env.APP_ENV = environment

// Success message
console.log(`✓ Environment configured for ${environment}`)
console.log(`  Loaded ${Object.keys(envVars).length} environment variables from ${path.basename(envFilePath)}`)

// Log which backend URLs are being used (without showing the full URL for security)
const backendUrl = envVars.PERA_MAINNET_BACKEND_URL || ''
const domain = backendUrl.replace(/^https?:\/\/([^/]+).*$/, '$1')
console.log(`  Backend: ${domain || 'not configured'}`)

// Export variables for shell scripts to source
// This allows the calling script to use these variables
const exportScript = Object.keys(envVars)
  .map(key => `export ${key}="${envVars[key]}"`)
  .join('\n')

// Write to temporary file that can be sourced
const exportPath = path.join(__dirname, '.env-exports.sh')
fs.writeFileSync(exportPath, exportScript)

// Success
process.exit(0)
