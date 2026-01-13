# Fastlane Match Setup Guide

This guide walks through setting up Fastlane Match for iOS code signing across the team.

## What is Match?

Fastlane Match is a tool that syncs code signing certificates and provisioning profiles across your team using a git repository. It solves the problem of managing certificates manually and ensures everyone on the team has the same signing setup.

## Prerequisites

- Apple Developer account with Admin or App Manager role
- Access to create a private git repository
- Xcode installed and configured
- Fastlane installed (`bundle install` from apps/mobile)
- All three iOS schemes created (Mobile-Dev, Mobile-Staging, Mobile-Production)

## Step 1: Create Certificates Repository

Create a **private** git repository to store encrypted certificates and profiles.

### Option A: GitHub

```bash
# Using GitHub CLI
gh repo create pera-wallet-certificates --private

# Or manually create at https://github.com/new
# - Name: pera-wallet-certificates
# - Visibility: Private
# - Don't initialize with README (empty repo is preferred)
```

### Option B: GitLab, Bitbucket, or Self-Hosted

Create a private repository on your git hosting platform. The repository should be:

- **Private** (critical for security)
- **Empty** (Match will initialize it)
- **Accessible** via HTTPS or SSH

## Step 2: Configure Match Environment Variables

Add Match configuration to your Fastlane environment files:

**In `fastlane/.env.default`** (already added):

```bash
MATCH_GIT_URL=https://github.com/your-org/pera-wallet-certificates
MATCH_PASSWORD=
```

**In `fastlane/.env.staging`**:

```bash
MATCH_GIT_URL=https://github.com/your-org/pera-wallet-certificates
MATCH_PASSWORD=your-strong-password-here
```

**In `fastlane/.env.production`**:

```bash
MATCH_GIT_URL=https://github.com/your-org/pera-wallet-certificates
MATCH_PASSWORD=your-strong-password-here
```

### Generate a Strong Password

```bash
# macOS
openssl rand -base64 32

# Or use a password manager to generate a 32+ character password
```

**Important**: Store this password securely! You'll need it to:

- Add certificates in the future
- Onboard new team members
- Use certificates in CI/CD

If you lose the password, you'll need to revoke all certificates and start over.

## Step 3: Initialize Match

From the `apps/mobile` directory:

```bash
cd apps/mobile

# Initialize Match
bundle exec fastlane match init
```

You'll be prompted:

1. **Storage mode**: Select `git`
2. **Git URL**: Enter your certificates repository URL
    - Example: `https://github.com/your-org/pera-wallet-certificates`
    - Or SSH: `git@github.com:your-org/pera-wallet-certificates.git`

This creates a `Matchfile` (which we already have configured).

## Step 4: Generate Certificates

### Set Required Environment Variables

```bash
# Export environment variables for this session
export MATCH_PASSWORD="your-password-here"
export APPLE_ID="your-apple-id@example.com"
export MATCH_GIT_URL="https://github.com/your-org/pera-wallet-certificates"

# Your Apple Developer Team ID (10-character alphanumeric)
export APPLE_TEAM_ID="XXXXXXXXXX"
```

**Find your Team ID:**

1. Go to https://developer.apple.com/account
2. Click on "Membership" in the sidebar
3. Your Team ID is shown on this page

### Generate Development Certificates

```bash
bundle exec fastlane match development \
  --app_identifier "com.algorand.perarn.dev,com.algorand.perarn.staging,com.algorand.perarn" \
  --username "$APPLE_ID" \
  --team_id "$APPLE_TEAM_ID"
```

You may be prompted to:

- Sign in to your Apple ID
- Enable 2FA verification
- Grant Fastlane access to your Apple Developer account

### Generate App Store Distribution Certificates

```bash
bundle exec fastlane match appstore \
  --app_identifier "com.algorand.perarn.dev,com.algorand.perarn.staging,com.algorand.perarn" \
  --username "$APPLE_ID" \
  --team_id "$APPLE_TEAM_ID"
```

### Generate Ad Hoc Certificates (for staging)

```bash
bundle exec fastlane match adhoc \
  --app_identifier "com.algorand.perarn.staging" \
  --username "$APPLE_ID" \
  --team_id "$APPLE_TEAM_ID"
```

## Step 5: Verify Match Setup

Check that certificates were created in your repository:

```bash
# Clone the certificates repo to verify
git clone https://github.com/your-org/pera-wallet-certificates /tmp/cert-check
cd /tmp/cert-check
ls -la

# You should see:
# - certs/
# - profiles/
# - README.md (created by Match)
```

The files are encrypted using your `MATCH_PASSWORD`.

## Step 6: Update Xcode Project (if needed)

If Xcode doesn't automatically recognize the new certificates:

1. Open `mobile.xcworkspace` in Xcode
2. Select the **mobile** target
3. Go to **Signing & Capabilities**
4. For each configuration (Debug, Staging, Release):
    - Ensure "Automatically manage signing" is **unchecked**
    - Select the correct provisioning profile from the dropdown
    - Profile names will be like "match Development com.algorand.perarn.dev"

## Step 7: Test Builds

Test that signing works for each scheme:

```bash
# Development
bundle exec fastlane ios build_dev

# Staging
bundle exec fastlane ios build_staging

# Production
bundle exec fastlane ios build_production
```

If successful, you'll find .ipa files in `./build/ios/`.

## Team Member Onboarding

When a new team member needs access to certificates:

1. **Grant Repository Access**: Add them to the certificates repository

2. **Share Match Password**: Securely share the `MATCH_PASSWORD` (use 1Password, LastPass, etc.)

3. **Set Environment Variables**: They should add to their local environment:

    ```bash
    export MATCH_PASSWORD="the-shared-password"
    export MATCH_GIT_URL="https://github.com/your-org/pera-wallet-certificates"
    ```

4. **Sync Certificates**: Download certificates on their machine:
    ```bash
    cd apps/mobile
    bundle exec fastlane match development --readonly
    bundle exec fastlane match appstore --readonly
    ```

The `--readonly` flag prevents creating new certificates (download only).

## CI/CD Integration

For GitHub Actions or other CI systems:

1. **Store as Secrets**:
    - `MATCH_PASSWORD`
    - `MATCH_GIT_URL`
    - `APPLE_ID` (or use App Store Connect API key)
    - `APPLE_TEAM_ID`

2. **Use Readonly Mode**: Always use `readonly: true` in CI to prevent creating new certificates:

    ```ruby
    match(
      type: "appstore",
      readonly: true,
      app_identifier: ["com.algorand.perarn"]
    )
    ```

3. **Setup Example** (in GitHub Actions):
    ```yaml
    - name: Setup Match Certificates
      env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_URL: ${{ secrets.MATCH_GIT_URL }}
      run: |
          cd apps/mobile
          bundle exec fastlane match appstore --readonly
    ```

## Troubleshooting

### "Could not decrypt the repo"

- Check that `MATCH_PASSWORD` is set correctly
- Verify you're using the exact same password that was used to encrypt
- Password is case-sensitive

### "Certificate already exists"

- Match found an existing certificate that it doesn't manage
- Options:
    1. Revoke the existing certificate manually in Apple Developer Portal
    2. Use `--force` flag to regenerate (not recommended)
    3. Use the existing certificate if it's still valid

### "Provisioning profile doesn't match"

- App identifier in Match doesn't match bundle ID in Xcode
- Verify bundle IDs match exactly:
    - `com.algorand.perarn.dev`
    - `com.algorand.perarn.staging`
    - `com.algorand.perarn`
- Regenerate profiles: `bundle exec fastlane match appstore --force_for_new_devices`

### "Authentication failed"

- Your Apple ID credentials may be incorrect
- 2FA may have expired
- Try logging in manually: `fastlane spaceauth -u your-apple-id@example.com`

### Git Authentication Issues

**HTTPS**: Use personal access token or app password instead of your account password

**SSH**: Ensure your SSH key is added to your git hosting platform

## Best Practices

1. **Use Strong Passwords**: Generate random 32+ character passwords for `MATCH_PASSWORD`

2. **Limit Repository Access**: Only give access to team members who need it

3. **Use Readonly in CI**: Prevent CI from creating new certificates

4. **Regular Audits**: Periodically review who has access to the certificates repository

5. **Certificate Expiration**: Certificates expire after 1 year. Match will handle renewal automatically when you run `match appstore` again

6. **Backup Match Password**: Store in multiple secure locations (team password manager, encrypted backup)

7. **Git Hosting Security**:
    - Enable 2FA on git hosting account
    - Use repository-specific deploy keys in CI
    - Enable audit logging

## Certificate Renewal

Apple certificates expire after one year. To renew:

```bash
# This will create new certificates and update the repository
bundle exec fastlane match appstore --force

# Or let Match handle it automatically when the certificate is about to expire
bundle exec fastlane match appstore
```

Match will notify you when certificates are close to expiration.

## Advanced: Using App Store Connect API

Instead of Apple ID + password, you can use App Store Connect API keys (more secure for CI):

1. **Create API Key** in App Store Connect:
    - Go to Users and Access → Keys
    - Create a new key with App Manager role
    - Download the .p8 file

2. **Configure Fastlane**:

    ```ruby
    app_store_connect_api_key(
      key_id: ENV["ASC_KEY_ID"],
      issuer_id: ENV["ASC_ISSUER_ID"],
      key_filepath: ENV["ASC_KEY_PATH"]
    )
    ```

3. **Use in CI**: Store the .p8 file as a base64-encoded secret

## Resources

- [Fastlane Match Documentation](https://docs.fastlane.tools/actions/match/)
- [Code Signing Guide](https://codesigning.guide/)
- [Apple Developer Portal](https://developer.apple.com/account)

## Summary

✅ **After completing this setup:**

- All iOS certificates are securely stored in git
- Team members can sync certificates with one command
- CI/CD can build and sign automatically
- No more "Code signing error" frustrations
- Easy onboarding for new developers
