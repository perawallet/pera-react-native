*** Settings ***
Documentation       Staking: Menu -> Staking behind the shared age gate. Projects come from remote
...                 config, and opening one pushes its site in the in-app browser after a one-time
...                 disclaimer that unlocks only once scrolled to the end.
Resource            discover.resource


*** Variables ***
${MENU_STAKING_BUTTON}          tid=menu_staking_button
${STAKING_SUBTITLE}             tid=staking-subtitle
${STAKING_HELP_BUTTON}          tid=staking-help-button
${STAKING_HELP_TITLE}           tid=staking-help-sheet-title
${STAKING_ERROR_TITLE}          tid=staking-error-title
# Card ids come from remote config, so match the prefix on either platform's id attribute.
${STAKING_FIRST_CARD}           xpath=(//*[starts-with(@content-desc, 'staking-project-card-') or starts-with(@resource-id, 'staking-project-card-') or starts-with(@name,'staking-project-card-')])[1]
${STAKING_DISCLAIMER_TITLE}     tid=staking-disclaimer-title
${STAKING_DISCLAIMER_ACCEPT}    tid=staking-disclaimer-accept-button
${WEBVIEW_CLOSE_BUTTON}         tid=webview_close_button
${STAKING_EMPTY_VIEW}           tid=staking-empty-view
${STAKING_SETTLED}              xpath=//*[starts-with(@content-desc,'staking-project-card-') or starts-with(@resource-id,'staking-project-card-') or starts-with(@name,'staking-project-card-') or @content-desc='staking-error-title' or @resource-id='staking-error-title' or @name='staking-error-title' or @resource-id='staking-empty-view' or @name='staking-empty-view']


*** Keywords ***
Open Staking
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    Tap    ${MENU_TAB}
    Open Past Age Gate    ${MENU_STAKING_BUTTON}    ${STAKING_SUBTITLE}

Staking Projects Should Be Listed
    [Documentation]    Projects come from remote config; an empty or failed fetch is an environment
    ...                gap, not an app regression, so the case is skipped rather than failed.
    Wait Until Page Contains Element    ${STAKING_SETTLED}    timeout=30s
    ${listed}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_FIRST_CARD}
    IF    not ${listed}    Capture Page Screenshot
    Skip If    not ${listed}    No staking projects loaded (remote config empty or unreachable).

Tap First Project
    [Documentation]    Returns whether the disclaimer showed rather than the project opening directly.
    ...                Once the disclaimer has been accepted the tap goes straight to the project,
    ...                which is a webview over the network and the slower of the two outcomes; 20s
    ...                was not enough for it on a cold run.
    Tap    ${STAKING_FIRST_CARD}
    FOR    ${i}    IN RANGE    90
        ${disclaimer}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_DISCLAIMER_TITLE}
        IF    ${disclaimer}    RETURN    ${True}
        ${project}=    Run Keyword And Return Status    Page Should Contain Element    ${WEBVIEW_CLOSE_BUTTON}
        IF    ${project}    RETURN    ${False}
        Sleep    0.5s
    END
    Fail    Tapping a project opened neither the disclaimer nor the project page in 45s.

Open Disclaimer
    [Documentation]    The disclaimer shows until accepted once per install, so a run after an
    ...                accepting case clears the app's one-time flags to bring it back.
    ${disclaimer}=    Tap First Project
    IF    ${disclaimer}    RETURN
    Close Project Page
    Clear One-Time Flags
    Open Staking
    Staking Projects Should Be Listed
    ${disclaimer}=    Tap First Project
    Should Be True    ${disclaimer}    Clearing the one-time flags did not bring the disclaimer back.

Accept Should Be Disabled Before Scrolling
    [Documentation]    The button sits below the fold, and Android lists it only once on screen. Short
    ...                steps bring it in before the end of the text unlocks it: about 160px separate the
    ...                two on a phone, and each step scrolls about 120px. Large system text (1.5x on
    ...                the Pixel) makes the text about 30 steps long.
    Wait Until Settled    ${STAKING_DISCLAIMER_TITLE}
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    VAR    ${x}    ${{ int(${w} / 2) }}
    FOR    ${i}    IN RANGE    45
        ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_DISCLAIMER_ACCEPT}
        IF    ${present}
            Element Should Be Disabled    ${STAKING_DISCLAIMER_ACCEPT}
            RETURN
        END
        Swipe    start_x=${x}    start_y=${{ int(${h} * 0.7) }}    end_x=${x}    end_y=${{ int(${h} * 0.65) }}    duration=400ms
    END
    Fail    The accept button never came on screen.

Scroll Disclaimer To The End
    Wait Until Settled    ${STAKING_DISCLAIMER_TITLE}
    FOR    ${i}    IN RANGE    6
        ${enabled}=    Run Keyword And Return Status    Element Should Be Enabled    ${STAKING_DISCLAIMER_ACCEPT}
        IF    ${enabled}    RETURN
        Swipe By Percent    50    80    50    25    duration=400ms
    END
    Element Should Be Enabled    ${STAKING_DISCLAIMER_ACCEPT}

Close Disclaimer
    [Documentation]    Scrolled to the end, a downward swipe can scroll the text back instead of
    ...                closing the sheet, so close until the title is gone.
    FOR    ${i}    IN RANGE    3
        Close Sheet
        ${open}=    Run Keyword And Return Status    Page Should Contain Element    ${STAKING_DISCLAIMER_TITLE}
        IF    not ${open}    RETURN
    END
    Page Should Not Contain Element    ${STAKING_DISCLAIMER_TITLE}

Accept Disclaimer
    Scroll Disclaimer To The End
    # The text keeps coasting after the swipe that unlocked the button.
    Wait Until Settled    ${STAKING_DISCLAIMER_ACCEPT}
    Tap    ${STAKING_DISCLAIMER_ACCEPT}

Project Page Should Be Open
    Wait Until Page Contains Element    ${WEBVIEW_CLOSE_BUTTON}    timeout=30s

Close Project Page
    Tap    ${WEBVIEW_CLOSE_BUTTON}
    Wait Until Page Contains Element    ${STAKING_SUBTITLE}    timeout=15s
