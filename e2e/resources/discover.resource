*** Settings ***
Documentation       Discover is a full-screen WebView of a remote site behind the shared age gate. Only
...                 the native shell is asserted; in-page content would need a webview context.
Resource            settings.resource


*** Variables ***
# Tabs other than Menu have no testID; both platforms expose the visible label.
${DISCOVER_TAB}             tid=Discover
${HOME_TAB}                 tid=Home
${MORE_BUTTON}              tid=more_button
# The declaration's buttons have no testID (ConfirmActionContent takes no confirmTestID here).
${AGE_GATE_CONFIRM}         xpath=//*[@text='I am 18 or older' or @label='I am 18 or older']
${AGE_GATE_RETRY}           tid=age-gate-retry
${WEBVIEW_OFFLINE}          tid=pw-webview-offline
${WEBVIEW_TIMEOUT}          tid=pw-webview-timeout
# The Debug Tools row to Manage Cache has no testID.
${DEBUG_TOOLS_MANAGE_CACHE}     xpath=//*[@text='Manage Cache' or @label='Manage Cache']
${CLEAR_ONE_TIME_FLAGS}         tid=manage_cache_clear_flags_button


*** Keywords ***
Open Past Age Gate
    [Documentation]    Taps ${entry} and accepts the age declaration if it shows, until ${destination}
    ...                is up. A late first-run prompt can swallow the first tap, so the entry is
    ...                tapped again while it is still on screen.
    [Arguments]    ${entry}    ${destination}    ${also_dismiss}=${NONE}
    Wait Until Page Contains Element    ${entry}    timeout=30s
    Tap    ${entry}
    FOR    ${i}    IN RANGE    60
        ${there}=    Run Keyword And Return Status    Page Should Contain Element    ${destination}
        IF    ${there}    RETURN
        Tap If Present    ${AGE_GATE_CONFIRM}
        IF    $also_dismiss    Tap If Present    ${also_dismiss}
        IF    ${i} % 10 == 9    Tap If Present    ${entry}
        Sleep    0.5s
    END
    Fail    ${destination} did not appear after opening ${entry}.

Open Discover
    Open Past Age Gate    ${DISCOVER_TAB}    ${WEBVIEW}

Discover Page Should Be Loaded
    Wait Until Page Contains Element    ${WEBVIEW}    timeout=60s
    Page Should Not Contain Element    ${AGE_GATE_RETRY}
    Page Should Not Contain Element    ${WEBVIEW_OFFLINE}
    Page Should Not Contain Element    ${WEBVIEW_TIMEOUT}

Clear One-Time Flags
    [Documentation]    Developer > Debug Tools > Manage Cache: resets the age declaration and every
    ...                one-time prompt and disclaimer, so a case can see them again.
    Open Settings
    Open From Settings    ${SETTINGS_ITEM_DEVELOPER}    ${DEVELOPER_NODE_ITEM}
    # A back tap while the screen still slides in is dropped.
    Wait Until Settled    ${DEVELOPER_NODE_ITEM}
    ${unlocked}=    Run Keyword And Return Status    Page Should Contain Element    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    IF    not ${unlocked}
        Tap Back
        Unlock Debug Tools
        Open From Settings    ${SETTINGS_ITEM_DEVELOPER}    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    END
    # Each row exists while its screen still slides in, and a tap there is dropped.
    Wait Until Settled    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    Tap    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    Wait Until Settled    ${DEBUG_TOOLS_MANAGE_CACHE}
    Tap    ${DEBUG_TOOLS_MANAGE_CACHE}
    Wait Until Settled    ${CLEAR_ONE_TIME_FLAGS}
    Tap    ${CLEAR_ONE_TIME_FLAGS}
    Go Home
