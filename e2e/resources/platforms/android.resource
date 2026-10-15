*** Settings ***
Documentation       Android adapter. Everything platform-specific lives in this file and its iOS twin;
...                 tests and shared keywords never branch on the platform.
Library             AppiumLibrary    run_on_failure=Nothing
Library             Collections


*** Variables ***
${APPIUM_URL}           http://127.0.0.1:4723
${ANDROID_PACKAGE}      com.algorand.perarn.staging
${ANDROID_ACTIVITY}     com.algorand.perarn.staging.MainActivity
${ANDROID_UDID}         ${EMPTY}
# Off UiAutomator2's default 8200, which another session's forward can hold and crash instrumentation.
# Give each device its own port when several run in parallel.
${ANDROID_SYSTEM_PORT}  8201
${WEBVIEW}             xpath=//android.webkit.WebView
${MENU_TAB}             accessibility_id=Menu


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
    # the notification dialog over the app on its next launch.
    Execute Script    mobile: changePermissions    permissions=all    appPackage=${ANDROID_PACKAGE}    action=grant

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
    Input Text    accessibility_id=import_account_word_input_0    ${phrase}

Get Text In Container
    # A testID-only container is a resource-id on Android, with its text in following siblings.
    [Arguments]    ${test_id}    ${n}
    ${text}=    Get Text    xpath=//*[@resource-id='${test_id}']/following-sibling::android.widget.TextView[${n}]
    RETURN    ${text}

Close Sheet
    Swipe By Percent    50    40    50    90    duration=800ms
