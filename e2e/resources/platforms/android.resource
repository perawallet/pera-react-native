*** Settings ***
Documentation       Android adapter. Everything platform-specific lives in this file and its iOS twin;
...                 tests and shared keywords never branch on the platform.
Library             AppiumLibrary    run_on_failure=Nothing
Library             Collections
Library             Process


*** Variables ***
${APPIUM_URL}           http://127.0.0.1:4723
${ANDROID_PACKAGE}      com.algorand.perarn.staging
${ANDROID_ACTIVITY}     com.algorand.perarn.staging.MainActivity
${ANDROID_UDID}         ${EMPTY}
# Off UiAutomator2's default 8200, which another session's forward can hold and crash instrumentation.
# Give each device its own port when several run in parallel.
${ANDROID_SYSTEM_PORT}  8201
${WEBVIEW}             xpath=//android.webkit.WebView
${MENU_TAB}             xpath=//*[@resource-id='tab_menu_button' or @content-desc='Menu' or @name='Menu']


*** Keywords ***
Open Pera
    &{caps}=    Create Dictionary
    ...    platformName=Android
    ...    automationName=UiAutomator2
    ...    appPackage=${ANDROID_PACKAGE}
    ...    appActivity=${ANDROID_ACTIVITY}
    ...    autoGrantPermissions=${True}
    ...    noReset=${True}
    ...    autoLaunch=${False}
    ...    disableWindowAnimation=${True}
    ...    systemPort=${{int($ANDROID_SYSTEM_PORT)}}
    ...    ignoreHiddenApiPolicyError=${True}
    # UiAutomator2 otherwise waits up to 10s for an idle app before each action; RN apps rarely idle.
    ...    waitForIdleTimeout=${0}
    IF    $ANDROID_UDID    Set To Dictionary    ${caps}    udid=${ANDROID_UDID}
    Open Application    ${APPIUM_URL}    &{caps}
    # autoGrantPermissions only covers installs Appium makes; an adb-installed build would raise
    # the notification dialog over the app on its next launch. BrowserStack installs through
    # Appium and refuses this adb grant, which would otherwise fail every suite's setup.
    Run Keyword And Ignore Error
    ...    Execute Script    mobile: changePermissions    permissions=all    appPackage=${ANDROID_PACKAGE}    action=grant

Dismiss Dev Client Intro
    # First launch of a dev client opens its developer menu over the app; Continue leaves the menu up.
    ${intro}=    Run Keyword And Return Status
    ...    Page Should Contain Element    xpath=//*[@text='Continue']
    IF    not ${intro}    RETURN
    Click Element    xpath=//*[@text='Continue']
    Press Keycode    4

Restart Pera
    Terminate Application    ${ANDROID_PACKAGE}
    Activate Application    ${ANDROID_PACKAGE}

Open Deeplink
    [Arguments]    ${url}
    Execute Script    mobile: deepLink    url=${url}    package=${ANDROID_PACKAGE}

Dismiss Keyboard
    Run Keyword And Ignore Error    Hide Keyboard

Enter Recovery Phrase
    # The import screen spreads a pasted phrase across its word fields.
    [Arguments]    ${phrase}
    Input Text    xpath=//*[@resource-id='import_account_word_input_0' or @name='import_account_word_input_0' or @content-desc='import_account_word_input_0']    ${phrase}

Get Text In Container
    # A testID-only container is a resource-id on Android, with its text in following siblings.
    [Arguments]    ${test_id}    ${n}
    ${text}=    Get Text    xpath=//*[@resource-id='${test_id}']/following-sibling::android.widget.TextView[${n}]
    RETURN    ${text}

Get Test ID
    # A bare testID is a resource-id here; content-desc only carries an accessibility label,
    # and reading that instead returned the row's spoken text ("E2E, LNVFD...SWQRA, Algo, 0.00"),
    # which then went into a deeplink as if it were an address.
    [Arguments]    ${element}
    ${id}=    Get Element Attribute    ${element}    resource-id
    IF    not $id
        ${id}=    Get Element Attribute    ${element}    content-desc
    END
    RETURN    ${id}

Scroll Into View
    [Documentation]    Scrolls the first scrollable until the element with this test ID is on screen,
    ...                in one driver call (UiScrollable) instead of a swipe-and-look loop. A bare
    ...                testID (no accessibility label) is a resource-id on Android: pass by=resourceId.
    [Arguments]    ${test_id}    ${by}=resourceId
    ${selector}=    Set Variable    new UiSelector().${by}("${test_id}")
    Wait Until Page Contains Element
    ...    android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(${selector})    timeout=10s

Close Sheet
    # Tap the backdrop above the sheet, as on iOS. A swipe starting on the backdrop of a short
    # sheet never reaches its pan handler, and hardware back is blocked while a sheet is open.
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    Execute Script    mobile: clickGesture    x=${{int(${w} * 0.5)}}    y=${{int(${h} * 0.08)}}

Open Deeplink Cold
    [Documentation]    Fires the link at a stopped app, so it cold-starts on it (Linking.getInitialURL).
    [Arguments]    ${url}
    Terminate Application    ${ANDROID_PACKAGE}
    Open Deeplink    ${url}

Adb
    [Documentation]    For what the Appium session cannot do. Needs adb on the machine that runs Robot.
    [Arguments]    @{args}
    @{target}=    Set Variable If    $ANDROID_UDID    ${{ ['-s', $ANDROID_UDID] }}    ${{ [] }}
    ${result}=    Run Process    adb    @{target}    @{args}
    Should Be Equal As Integers    ${result.rc}    0    adb ${args} failed: ${result.stderr}
    RETURN    ${result.stdout}

Deny Camera Permission
    [Documentation]    Revoking kills the app; relaunch it after. user-fixed is "Don't ask again", so the
    ...                app gets a denial without a system dialog (pm set-permission-flags needs Android 11+).
    Adb    shell    pm    revoke    ${ANDROID_PACKAGE}    android.permission.CAMERA
    ${fixed}=    Run Keyword And Return Status
    ...    Adb    shell    pm    set-permission-flags    ${ANDROID_PACKAGE}    android.permission.CAMERA    user-fixed
    Skip If    not ${fixed}
    ...    This Android version cannot pre-deny the camera (pm set-permission-flags), so the app would get a permission dialog instead of a denial.

Grant Camera Permission
    Run Keyword And Ignore Error
    ...    Adb    shell    pm    clear-permission-flags    ${ANDROID_PACKAGE}    android.permission.CAMERA    user-fixed
    Adb    shell    pm    grant    ${ANDROID_PACKAGE}    android.permission.CAMERA

Screen Should Be Capture Protected
    [Documentation]    FLAG_SECURE on the app's window is what blacks out screenshots and recordings.
    ${windows}=    Adb    shell    dumpsys    window    ${ANDROID_PACKAGE}
    Should Match Regexp    ${windows}    fl=.*\\bSECURE\\b    msg=No ${ANDROID_PACKAGE} window has FLAG_SECURE.

Screen Should Not Be Capture Protected
    ${windows}=    Adb    shell    dumpsys    window    ${ANDROID_PACKAGE}
    Should Not Match Regexp    ${windows}    fl=.*\\bSECURE\\b    msg=A ${ANDROID_PACKAGE} window still has FLAG_SECURE.

Set Network Offline
    Execute Script    mobile: setConnectivity    wifi=${False}    data=${False}

Set Network Online
    Execute Script    mobile: setConnectivity    wifi=${True}    data=${True}

Enroll Biometrics
    [Documentation]    An emulator enrols a fingerprint only through the Settings screen-lock flow, which
    ...                this harness does not drive; a device enrolled beforehand still runs biometric cases.
    # Skip before the case raises the system prompt, which would cover the app for its teardown.
    Skip If    not $ANDROID_UDID.startswith('emulator-')
    ...    A physical Android device cannot be fed a fingerprint from the host.

Match Biometric
    [Documentation]    Emulator only: touches with fingerprint 1. A touch with no prompt up is ignored.
    Skip If    not $ANDROID_UDID.startswith('emulator-')
    ...    A physical Android device cannot be fed a fingerprint from the host.
    Adb    emu    finger    touch    1

Rows With Prefix
    [Documentation]    Every element whose testID begins with ${prefix}. See the iOS twin: there a
    ...                predicate replaces the xpath for speed; UiAutomator2 handles the xpath fine.
    [Arguments]    ${prefix}
    RETURN    xpath=//*[starts-with(@resource-id,'${prefix}') or starts-with(@content-desc,'${prefix}')]
