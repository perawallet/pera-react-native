# iOS Xcode Configuration Setup

This guide explains how to complete the iOS configuration in Xcode for the three environment schemes (Dev, Staging, Production).

## Overview

The xcconfig files have been created in `Config/` directory. Now you need to:

1. Add xcconfig files to Xcode project
2. Link xcconfig files to build configurations
3. Create/duplicate schemes for each environment

## Step 1: Add xcconfig Files to Xcode Project

1. Open `mobile.xcworkspace` in Xcode:

    ```bash
    open apps/mobile/ios/mobile.xcworkspace
    ```

2. In the Project Navigator (left sidebar), right-click on the `mobile` folder

3. Select **Add Files to "mobile"...**

4. Navigate to `apps/mobile/ios/Config/`

5. Select all `.xcconfig` files:
    - `Shared.xcconfig`
    - `Dev.xcconfig`
    - `Staging.xcconfig`
    - `Production.xcconfig`

6. Make sure these options are selected:
    - **✓** Copy items if needed (unchecked - we want references)
    - **✓** Create groups
    - **✓** Add to targets: mobile (checked)

7. Click **Add**

## Step 2: Link xcconfig Files to Build Configurations

1. In Xcode, click on the **mobile** project in the Project Navigator (blue icon at the top)

2. Select the **mobile** project (not the target) in the main editor

3. Select the **Info** tab

4. Under **Configurations**, you should see two configurations:
    - Debug
    - Release

5. For each configuration, set the xcconfig file:

    **For Debug configuration:**
    - Click on **Debug** row
    - Under "Based on Configuration File", select **Dev** from the dropdown for the mobile target

    **For Release configuration:**
    - Click on **Release** row
    - Under "Based on Configuration File", select **Production** from the dropdown for the mobile target

6. **Add a new Staging configuration:**
    - Click the **+** button at the bottom of the Configurations list
    - Select **Duplicate "Release" Configuration**
    - Name it **Staging**
    - Under "Based on Configuration File", select **Staging** for the mobile target

## Step 3: Create Schemes

### Create Mobile-Dev Scheme

1. Click on the scheme selector (next to the Run/Stop buttons) → **Manage Schemes...**

2. Click the **+** button to add a new scheme

3. Name it **Mobile-Dev**

4. Set **Target** to **mobile**

5. Click **OK**

6. Select **Mobile-Dev** in the schemes list and click **Edit**

7. For each action (Run, Test, Profile, Analyze, Archive):
    - Select the action in the left sidebar
    - Set **Build Configuration** to **Debug**

8. Click **Close**

### Create Mobile-Staging Scheme

1. In the Manage Schemes dialog, duplicate the **Mobile-Dev** scheme:
    - Select **Mobile-Dev**
    - Click the gear icon (⚙️) at the bottom
    - Select **Duplicate**

2. Rename it to **Mobile-Staging**

3. Click **Edit** for Mobile-Staging

4. For each action (Run, Test, Profile, Analyze, Archive):
    - Select the action in the left sidebar
    - Set **Build Configuration** to **Staging**

5. Click **Close**

### Create Mobile-Production Scheme

1. In the Manage Schemes dialog, duplicate the **Mobile-Staging** scheme:
    - Select **Mobile-Staging**
    - Click the gear icon (⚙️) at the bottom
    - Select **Duplicate**

2. Rename it to **Mobile-Production**

3. Click **Edit** for Mobile-Production

4. For each action (Run, Test, Profile, Analyze, Archive):
    - Select the action in the left sidebar
    - Set **Build Configuration** to **Release**

5. Click **Close**

### Make Schemes Shared

For each scheme (Mobile-Dev, Mobile-Staging, Mobile-Production):

1. In the Manage Schemes dialog, check the **Shared** checkbox
2. This allows the schemes to be committed to version control

Click **Close** to save all schemes.

## Step 4: Update React Native Build Phase

1. Click on the **mobile** target (under the mobile project)

2. Go to **Build Phases** tab

3. Find the phase named **Bundle React Native code and images**

4. Click to expand it

5. Update the shell script to export APP_ENV:

    Add this line at the top of the script (after the shebang if present):

    ```bash
    export APP_ENV="${APP_ENV}"
    ```

    The full script should look similar to:

    ```bash
    set -e

    export APP_ENV="${APP_ENV}"

    WITH_ENVIRONMENT="../node_modules/react-native/scripts/xcode/with-environment.sh"
    REACT_NATIVE_XCODE="../node_modules/react-native/scripts/react-native-xcode.sh"

    /bin/sh -c "$WITH_ENVIRONMENT $REACT_NATIVE_XCODE"
    ```

## Step 5: Verify Configuration

1. Switch between schemes using the scheme selector

2. For each scheme, go to **Product → Scheme → Edit Scheme**

3. Verify:
    - **Mobile-Dev**: Uses Debug configuration, bundle ID ends with `.dev`
    - **Mobile-Staging**: Uses Staging configuration, bundle ID ends with `.staging`
    - **Mobile-Production**: Uses Release configuration, bundle ID is `com.algorand.perarn`

4. Build each scheme to verify:
    ```bash
    # From command line
    xcodebuild -workspace mobile.xcworkspace -scheme Mobile-Dev -configuration Debug
    xcodebuild -workspace mobile.xcworkspace -scheme Mobile-Staging -configuration Staging
    xcodebuild -workspace mobile.xcworkspace -scheme Mobile-Production -configuration Release
    ```

## Step 6: Update Podfile (if needed)

If you encounter issues with CocoaPods not finding the configurations, update the Podfile:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      # Ensure Staging configuration exists
      if config.name == 'Staging'
        config.build_settings['CONFIGURATION'] = 'Staging'
      end
    end
  end
end
```

Then run:

```bash
cd ios && bundle exec pod install
```

## Verification Checklist

- [ ] All 4 xcconfig files are visible in Xcode Project Navigator
- [ ] Debug configuration uses Dev.xcconfig
- [ ] Staging configuration exists and uses Staging.xcconfig
- [ ] Release configuration uses Production.xcconfig
- [ ] Mobile-Dev scheme exists and uses Debug configuration
- [ ] Mobile-Staging scheme exists and uses Staging configuration
- [ ] Mobile-Production scheme exists and uses Release configuration
- [ ] All three schemes are marked as Shared
- [ ] APP_ENV is exported in React Native build phase
- [ ] Each scheme builds successfully
- [ ] Bundle IDs are different for each scheme (.dev, .staging, production)
- [ ] App display names are different (Pera Dev, Pera Staging, Pera)

## Troubleshooting

### "Config file not found"

- Ensure xcconfig files are added to the project (not just the file system)
- Check that file references are correct (not broken/red in Xcode)

### "Duplicate symbols" or "Conflicting configurations"

- Ensure each build configuration is linked to only ONE xcconfig file
- Check that no build settings are set at the target level that conflict with xcconfig

### "Bundle ID already in use"

- The bundle IDs must be unique for each environment
- Ensure Dev.xcconfig, Staging.xcconfig, and Production.xcconfig have different bundle IDs

### Pods configuration errors

- Run `cd ios && bundle exec pod install` after making configuration changes
- Clean build folder: Product → Clean Build Folder (Cmd+Shift+K)

### Scheme not found in Fastlane

- Ensure schemes are marked as **Shared** (checkbox in Manage Schemes)
- Shared schemes are stored in `mobile.xcodeproj/xcshareddata/xcschemes/`
- Commit these scheme files to version control

## Next Steps

After completing this setup:

1. Test each scheme by building in Xcode
2. Run Fastlane lanes to verify automation works
3. Configure code signing with Match
4. Test on physical devices

See `fastlane/README.md` for build automation instructions.
