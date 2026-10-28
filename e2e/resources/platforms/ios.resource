*** Settings ***
Documentation       iOS adapter; see android.resource.
Library             ../libraries/PeraAppiumLibrary.py    run_on_failure=Nothing    AS    AppiumLibrary
Library             Collections
Library             Process
Library             String


*** Variables ***
${APPIUM_URL}           http://127.0.0.1:4723
${IOS_BUNDLE_ID}        com.algorandllc.perarn.staging
${IOS_UDID}             ${EMPTY}
# One WebDriverAgent port per simulator when several run in parallel.
${IOS_WDA_PORT}         8100
# A dev client's own link to its Metro server, e.g. exp+pera-dev://expo-development-client/?url=...
# Set it for dev-client runs: a plain relaunch can land on the launcher instead of the app.
${IOS_DEV_CLIENT_URL}   ${EMPTY}
${WEBVIEW}             xpath=//XCUIElementTypeWebView
${MENU_TAB}             tid=tab_menu_button
# One probe for every startup prompt in @{STARTUP_PROMPT_IDS} (app.resource). A predicate, not an
# xpath: this is polled every half second after each launch, and an xpath walks the whole tree.
${STARTUP_PROMPT_ANY}   predicate=name IN {'pin_security_prompt_dont_ask_button', 'banners_carousel_modal_close', 'banner_prompt_close', 'analytics_consent_prompt_decline_button', 'biometrics_disabled_prompt_dismiss_button', 'legacy_quantum_prompt_dismiss_button'}


*** Keywords ***
Open Pera
    &{caps}=    Create Dictionary
    ...    platformName=iOS
    ...    automationName=XCUITest
    ...    bundleId=${IOS_BUNDLE_ID}
    ...    noReset=${True}
    # isHeadless: without it the driver reboots a DeviceHub simulator and opens a new window per
    # session. autoLaunch=false attaches to the running app, so a dev client keeps its Metro URL.
    ...    isHeadless=${True}
    ...    autoLaunch=${False}
    ...    autoAcceptAlerts=${True}
    # Skip XCUITest's settle-before-every-action waits; tests wait on their own anchors.
    ...    waitForQuiescence=${False}
    ...    waitForIdleTimeout=${0}
    ...    reduceMotion=${True}
    ...    wdaLocalPort=${{int($IOS_WDA_PORT)}}
    IF    $IOS_UDID    Set To Dictionary    ${caps}    udid=${IOS_UDID}
    IF    $IOS_UDID    Hide Dev Menu Button
    Open Application    ${APPIUM_URL}    &{caps}

Hide Dev Menu Button
    # A dev client's floating menu button is a window above the app that steals header taps.
    # Simulator only; a release build has none.
    Run Process    xcrun    simctl    spawn    ${IOS_UDID}    defaults    write    ${IOS_BUNDLE_ID}
    ...    EXDevMenuShowFloatingActionButton    -bool    false

Dismiss Dev Client Intro
    # First launch of a dev client opens its developer menu over the app; Continue leaves the menu up.
    ${intro}=    Run Keyword And Return Status
    ...    Page Should Contain Element    xpath=//XCUIElementTypeButton[@name='Continue']
    IF    not ${intro}    RETURN
    Click Element    xpath=//XCUIElementTypeButton[@name='Continue']
    Close Sheet

Restart Pera
    # The trace file restarts with the app; collect what this run wrote before it is overwritten.
    Drain Nav Log
    Terminate Application    ${IOS_BUNDLE_ID}
    IF    $IOS_DEV_CLIENT_URL
        Open Deeplink    ${IOS_DEV_CLIENT_URL}
    ELSE
        Activate Application    ${IOS_BUNDLE_ID}
    END

Open Deeplink
    [Arguments]    ${url}
    Execute Script    mobile: deepLink    url=${url}    bundleId=${IOS_BUNDLE_ID}
    # Newer runtimes confirm a custom-scheme link with an "Open in" SpringBoard alert.
    Run Keyword And Ignore Error    Execute Script    mobile: alert    action=accept    buttonLabel=Open

Dismiss Keyboard
    # Header taps work with the keyboard up on iOS, and Hide Keyboard costs ~3s failing there.
    No Operation

Enter Recovery Phrase
    # Typing the whole phrase into one field breaks words apart on iOS, so fill each field.
    [Arguments]    ${phrase}
    @{words}=    Split String    ${phrase}
    FOR    ${i}    ${word}    IN ENUMERATE    @{words}
        Input Text    tid=import_account_word_input_${i}    ${word}
    END

Get Text In Container
    [Arguments]    ${test_id}    ${n}
    ${text}=    Get Text    xpath=(//*[@name='${test_id}']//XCUIElementTypeStaticText)[${n}]
    RETURN    ${text}

Get Test ID
    [Arguments]    ${element}
    ${id}=    Get Element Attribute    ${element}    name
    RETURN    ${id}

Scroll Into View
    [Documentation]    Swipes until the element reports itself visible. iOS lists off-screen rows too,
    ...                so presence is not enough. mobile: scrollToElement fails on this XCUITest
    ...                (unrecognized selector), and mobile: scroll toVisible stops at its own count.
    # ${by} exists only to match the Android adapter's signature; xpath covers both here.
    [Arguments]    ${test_id}    ${by}=resourceId
    Wait Until Page Contains Element    tid=${test_id}    timeout=10s
    FOR    ${i}    IN RANGE    8
        ${visible}=    Get Element Attribute    tid=${test_id}    visible
        IF    $visible == 'true'    RETURN
        Swipe By Percent    50    75    50    35
    END
    Fail    ${test_id} never scrolled into view.

Close Sheet
    # Modal sheets hide the drag handle and their scroll view swallows swipes; tap the backdrop above.
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    Execute Script    mobile: tap    x=${{int(${w} * 0.5)}}    y=${{int(${h} * 0.08)}}

Open Deeplink Cold
    [Documentation]    Fires the link at a stopped app, so it cold-starts on it (Linking.getInitialURL).
    [Arguments]    ${url}
    Skip If    $IOS_DEV_CLIENT_URL
    ...    A dev client cold-started by a link opens its launcher, not the bundle; cold links need a release build.
    Drain Nav Log
    Terminate Application    ${IOS_BUNDLE_ID}
    Open Deeplink    ${url}

Simctl
    [Arguments]    ${command}    @{args}
    ${device}=    Set Variable If    $IOS_UDID    ${IOS_UDID}    booted
    ${result}=    Run Process    xcrun    simctl    ${command}    ${device}    @{args}
    Should Be Equal As Integers    ${result.rc}    0    simctl ${command} ${args} failed: ${result.stderr}

Deny Camera Permission
    [Documentation]    Simulator only. Changing a privacy grant terminates the app; relaunch it after.
    Simctl    privacy    revoke    camera    ${IOS_BUNDLE_ID}

Grant Camera Permission
    Simctl    privacy    grant    camera    ${IOS_BUNDLE_ID}

Screen Should Be Capture Protected
    Skip    iOS does not blank screenshots

Screen Should Not Be Capture Protected
    Skip    iOS does not blank screenshots

Set Network Offline
    Skip    The iOS simulator uses the host's network and has no per-device connectivity switch.

Set Network Online
    No Operation

Enroll Biometrics
    [Documentation]    The app binds biometric unlock to a Secure Enclave key, which a simulator cannot
    ...                create (SecKeyCreateRandomKey fails with -25293), so turning it on always fails there.
    Skip If    not $IOS_UDID or $IOS_UDID.count('-') == 4
    ...    A simulator has no Secure Enclave for the app's biometric key; biometric unlock needs a real device.
    Execute Script    mobile: enrollBiometric    isEnabled=${True}

Match Biometric
    [Documentation]    The simulator's model decides Face ID or Touch ID; the other notification is ignored.
    Execute Script    mobile: sendBiometricMatch    type=faceId    match=${True}
    Execute Script    mobile: sendBiometricMatch    type=touchId    match=${True}

Rows With Prefix
    [Documentation]    Every element whose testID begins with ${prefix}.
    ...
    ...                A predicate is evaluated inside XCUITest; the equivalent xpath walks the
    ...                entire element tree on every poll. Waiting for the pay-asset rows to GO
    ...                that way hung one command past WebDriverAgent's 240s proxy timeout and took
    ...                the whole session with it, which then failed the two suites after it too.
    [Arguments]    ${prefix}
    RETURN    predicate=name BEGINSWITH '${prefix}'
