# Development Environment Firebase Configuration

Place your Firebase `google-services.json` file for the **development** environment in this directory.

## Setup Instructions

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your development project
3. Go to Project Settings → General
4. Under "Your apps", find the Android app with package name: `com.algorand.pera.dev`
5. Download the `google-services.json` file
6. Place it in this directory: `apps/mobile/android/app/src/dev/google-services.json`

## Note

- Each environment (dev, staging, production) needs its own Firebase project/app configuration
- The package name must match the `applicationId` in build.gradle
- This file is gitignored and should not be committed to version control for official builds
- For open source builds, you can use a test Firebase project or omit this file (app will compile but Firebase features won't work)
