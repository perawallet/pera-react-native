*** Settings ***
Documentation       iOS adapter; see android.resource.
Library             ../libraries/PeraAppiumLibrary.py    run_on_failure=Nothing    AS    AppiumLibrary
Library             Collections
Library             Process
Library             String
Resource            session.resource


*** Variables ***
${APPIUM_URL}               http://127.0.0.1:4723
${IOS_BUNDLE_ID}            com.algorandllc.perarn.staging
${IOS_UDID}                 ${EMPTY}
# One WebDriverAgent port per simulator when several run in parallel.
${IOS_WDA_PORT}             8100
${IOS_WDA_REMOTE_PORT}      ${EMPTY}
${IOS_WDA_URL}              ${EMPTY}
${IOS_PLATFORM_VERSION}    ${EMPTY}
# A dev client's own link to its Metro server, e.g. exp+pera-dev://expo-development-client/?url=...
# Set it for dev-client runs: a plain relaunch can land on the launcher instead of the app.
${IOS_DEV_CLIENT_URL}       ${EMPTY}
${WEBVIEW}                  xpath=//XCUIElementTypeWebView
${MENU_TAB}                 tid=tab_menu_button
# One probe for every startup prompt in @{STARTUP_PROMPT_IDS} (app.resource). A predicate, not an
# xpath: this is polled every half second after each launch, and an xpath walks the whole tree.
${STARTUP_PROMPT_ANY}       predicate=name IN {'pin_security_prompt_dont_ask_button', 'banners_carousel_modal_close', 'banner_prompt_close', 'analytics_consent_prompt_decline_button', 'biometrics_disabled_prompt_dismiss_button', 'legacy_quantum_prompt_dismiss_button'}


*** Keywords ***
Open Pera
    &{caps}=    Create Dictionary
    ...    platformName=iOS
    ...    automationName=XCUITest
    ...    bundleId=${IOS_BUNDLE_ID}
    ...    noReset=${True}
    # isHeadless: without it the driver reboots a DeviceHub simulator and opens a new window per
    # session. autoLaunch=false attaches to the running app, so a dev client keeps its Metro URL.
    ...    autoLaunch=${False}
    ...    autoAcceptAlerts=${True}
    # Skip XCUITest's settle-before-every-action waits; tests wait on their own anchors.
    ...    waitForQuiescence=${False}
    ...    waitForIdleTimeout=${0}
    ...    reduceMotion=${True}
    ...    wdaLocalPort=${{int($IOS_WDA_PORT)}}
    IF    $IOS_UDID    Set To Dictionary    ${caps}    udid=${IOS_UDID}
    IF    $IOS_PLATFORM_VERSION    Set To Dictionary    ${caps}    platformVersion=${IOS_PLATFORM_VERSION}
    IF    $IOS_WDA_URL    Set To Dictionary    ${caps}    webDriverAgentUrl=${IOS_WDA_URL}
    IF    $IOS_WDA_REMOTE_PORT
        Set To Dictionary    ${caps}    wdaRemotePort=${{int($IOS_WDA_REMOTE_PORT)}}
    END
    ${simulator}=    Is iOS Simulator
    IF    ${simulator}    Set To Dictionary    ${caps}    isHeadless=${True}
    IF    ${simulator} and $IOS_UDID and $IOS_DEV_CLIENT_URL    Hide Dev Menu Button
    Open Appium Session    ${APPIUM_URL}    &{caps}

Is iOS Simulator
    # CoreSimulator IDs are UUIDs. With an implicit local target, Appium uses
    # a simulator unless configured to attach to an existing WDA.
    IF    $IOS_UDID    RETURN    ${{$IOS_UDID.count('-') == 4}}
    RETURN    ${{not $IOS_WDA_URL}}

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

Require Camera Permission Control
    ${simulator}=    Is iOS Simulator
    Skip If    not ${simulator}    Changing iOS camera grants through simctl requires a simulator.

Grant Camera Permission
    Simctl    privacy    grant    camera    ${IOS_BUNDLE_ID}

Screen Should Be Capture Protected
    Skip    iOS does not blank screenshots

Screen Should Not Be Capture Protected
    Skip    iOS does not blank screenshots

Set Network Offline
    Skip    The XCUITest adapter has no automated network switch for the iOS device under test.

Set Network Online
    No Operation

Enroll Biometrics
    Skip    Pera biometric unlock needs a physical Secure Enclave. Appium XCUITest simulates biometrics only on simulators.

Match Biometric
    Skip    Appium XCUITest simulates biometric matching only on simulators.

Rows With Prefix
    [Documentation]    Every element whose testID begins with ${prefix}.
    ...
    ...                A predicate is evaluated inside XCUITest; the equivalent xpath walks the
    ...                entire element tree on every poll. Waiting for the pay-asset rows to GO
    ...                that way hung one command past WebDriverAgent's 240s proxy timeout and took
    ...                the whole session with it, which then failed the two suites after it too.
    [Arguments]    ${prefix}
    RETURN    predicate=name BEGINSWITH '${prefix}'
