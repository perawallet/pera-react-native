*** Settings ***
Documentation       Keywords for the stress scenarios. They drive the same screens the other suites do and
...                 time what the user would wait for; nothing here reaches into the app. The tier
...                 (TIER) names a row of stress-tiers.json, the one place sizes and limits are defined.
Resource            app.resource
Resource            onboarding.resource
# Open Account Switcher is defined here and in send_receive.resource (which assets and transactions
# pull in), so the accounts one is called by its full name.
Resource            accounts.resource
Resource            assets.resource
Resource            transactions.resource
Resource            contacts.resource
Resource            walletconnect.resource
Library             libraries/StressMetrics.py


*** Variables ***
${TIER}                     S
${TIERS_FILE}               ${CURDIR}${/}..${/}stress-tiers.json
# The phrase of the tier's seeded wallet is read from the environment, never from here.
${STRESS_MNEMONIC_ENV}      STRESS_MNEMONIC
# Optional: the address of the large account to select before the asset, NFT and history cases.
${STRESS_ACCOUNT}           %{STRESS_ACCOUNT=}
# Accounts imported by hand on top of the tier's wallet, such as a real large account.
${EXTRA_ACCOUNTS}           %{STRESS_EXTRA_ACCOUNTS=0}
# Rows are suffixed with the asset id, so only a prefix match finds them.
${ASSET_ROW_ANY}            xpath=//*[starts-with(@content-desc,'asset_row_') or starts-with(@name,'asset_row_')]
${SCROLL_SWIPES}            15
# Discovery probes the backend for every account it derives, so it can take minutes.
${DISCOVERY_TIMEOUT}        15 min
${SWIPE_MS}                 400


*** Keywords ***
Begin Run
    ${sizes}=    Begin Stress Run    ${TIER}    ${PLATFORM}    ${TIERS_FILE}
    ${timeout}=    Stress Timeout Seconds
    Set Suite Variable    ${STRESS_SIZES}    ${sizes}
    Set Suite Variable    ${STRESS_TIMEOUT}    ${timeout}s

Start Stress Session
    [Documentation]    Needs the wallet Import Stress Wallet left on the device.
    Begin Run
    Start Pera With Wallet
    Clear Crash Log
    Select Stress Account

Finish Stress Session
    [Documentation]    Whatever the cases saw in the device log becomes a hard failure, and the numbers
    ...                are written even when a case failed.
    TRY
        ${kb}=    Read Memory Kb
        IF    $kb is not None    Record Surface Sample    session:memory    pss_kb=${kb}
        ${events}=    Read Crash Evidence
        FOR    ${event}    IN    @{events}
            Record Hard Failure    session    device-log    ${event}
        END
    FINALLY
        # A missing adb or crash-report tool still fails the teardown, but never costs the numbers.
        Write Stress Metrics
    END

Import Stress Wallet
    [Documentation]    Replaces the wallet with the one the tier's phrase recovers. Account discovery
    ...                runs for real. It is timed from the tap that submits the phrase to the first screen
    ...                after it (address selection, rekeyed accounts, naming or Home), and kept as a
    ...                reading rather than a verdict: it is slow by nature, and the restart, wallet removal
    ...                and typing before it are not the app's. Written to its own file so the measurement
    ...                run, which shares the output folder, does not replace it.
    Begin Run
    TRY
        Start Without Wallet
        Open Import Options From Welcome
        # Entering the phrase ends with the tap on Import, which is where discovery starts.
        Enter Recovery Phrase For    ${RECOVER_UNIVERSAL_WALLET}    ${STRESS_MNEMONIC_ENV}
        Start Surface Timer    import:discovery
        Wait Until Keyword Succeeds    ${DISCOVERY_TIMEOUT}    0.5s    Discovery Should Be Over
        Stop Surface Timer As Reading    import:discovery    discovery_ms
        Finish Import
    FINALLY
        Write Stress Metrics    filename=stress-setup-metrics.json
    END

Discovery Should Be Over
    [Documentation]    Any screen the import shows once discovery has returned.
    ${select}=    Run Keyword And Return Status    Page Should Contain Element    ${SELECT_ADDRESSES_CONTINUE}
    ${rekeyed}=    Run Keyword And Return Status    Page Should Contain Element    ${REKEYED_CONTINUE}
    ${naming}=    Run Keyword And Return Status    Page Should Contain Element    ${ACCOUNT_FINISH_BUTTON}
    ${home}=    Run Keyword And Return Status    Page Should Contain Element    ${MENU_TAB}
    Should Be True    ${select} or ${rekeyed} or ${naming} or ${home}

Select Stress Account
    [Documentation]    Makes the large account the selected one, scrolling the switcher to it. Without
    ...                STRESS_ACCOUNT the app's own selection stays.
    IF    not $STRESS_ACCOUNT    RETURN
    Go Home
    accounts.Open Account Switcher
    ${row}=    accounts.Switcher Row    ${STRESS_ACCOUNT}
    FOR    ${i}    IN RANGE    150
        ${shown}=    Run Keyword And Return Status    Element Should Be Visible    ${row}
        IF    ${shown}    BREAK
        Swipe By Percent    50    75    50    25    ${SWIPE_MS}
    END
    Tap    ${row}
    accounts.Wait Until Switcher Closed
    Go Home

Check Imported Account Count
    [Documentation]    Fails unless the wallet holds exactly the tier's accounts. Each tier needs a phrase of
    ...                its own: a phrase seeded for a bigger tier imports all of that tier's accounts, and
    ...                account 0 holds all of its data, so a smaller tier would measure the bigger one.
    ...                Run straight after the import, before anything is added by hand.
    Go Home
    accounts.Open Account Switcher
    ${seen}=    Count Switcher Accounts
    Go Home
    Should Be Equal As Integers    ${seen}    ${STRESS_SIZES}[accounts]
    ...    The wallet imported ${seen} accounts but tier ${TIER} has ${STRESS_SIZES}[accounts]. Use a phrase seeded for this tier only.

Expected Account Count
    [Documentation]    The tier's accounts plus any imported by hand (STRESS_EXTRA_ACCOUNTS).
    ${expected}=    Evaluate    ${STRESS_SIZES}[accounts] + int($EXTRA_ACCOUNTS)
    RETURN    ${expected}

Visible Asset Row Ids
    [Documentation]    The ids of the asset rows on screen, in order.
    @{rows}=    Get WebElements    ${ASSET_ROW_ANY}
    @{ids}=    Create List
    FOR    ${row}    IN    @{rows}
        ${id}=    Get Test ID    ${row}
        Append To List    ${ids}    ${id}
    END
    RETURN    ${ids}

Asset Rows Should Differ From
    [Arguments]    ${before}
    ${now}=    Visible Asset Row Ids
    Should Be True    $now != $before

Restore Asset View
    [Documentation]    Puts the sort and the filter back, so the next run starts from the same list. A case
    ...                sets FILTER_FLIPPED once it has toggled the filter.
    Go Home
    Apply Sort    ${SORT_DEFAULT}
    IF    ${FILTER_FLIPPED}
        Go Home
        Open Filter Sheet
        Tap    ${FILTER_HIDE_ZERO}
        Tap    ${FILTER_APPLY}
        Wait Until Page Does Not Contain Element    ${FILTER_APPLY}    timeout=${STRESS_TIMEOUT}
    END

Finish Assets Case
    TRY
        Restore Asset View
    FINALLY
        Capture Failure Screenshot
    END

Clean Up WC Sessions
    [Documentation]    Whatever a case left paired is removed, so the next run starts with an empty list.
    ...                Safe with nothing paired.
    TRY
        Go Home
        Run Keyword And Ignore Error    Open WC Sessions From Settings
        Clear All WC Sessions
    FINALLY
        Run Keyword And Ignore Error    Go Home
        Capture Failure Screenshot
    END

Measure Relaunch To First Screen
    [Documentation]    From just before Restart Pera to the first screen. It includes Appium's terminate and
    ...                activate calls, which Activate Application's own wait for the launch is part of.
    Start Surface Timer    startup:first-screen
    Restart Pera
    ${found}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=${STRESS_TIMEOUT}
    Stop Surface Timer    startup:first-screen    timed_out=${{not $found}}

Measure Contacts Search
    [Documentation]    Types a term that matches one contact and times until the list has filtered: that
    ...                contact's row is there and the first contact's is gone. The fixture is reloaded
    ...                first, so the list starts at the top with the target off screen, and the timer
    ...                starts before the typing, which is what the search costs.
    [Arguments]    ${count}
    ${last}=    Evaluate    ${count} - 1
    ${first_address}=    Contact Address    0
    ${last_address}=    Contact Address    ${last}
    ${first_row}=    Contact Row    ${first_address}
    ${last_row}=    Contact Row    ${last_address}
    Start With Stress Contacts    ${count}
    Wait Until Page Contains Element    ${first_row}    timeout=${STRESS_TIMEOUT}
    Tap    ${CONTACTS_SEARCH_INPUT}
    Start Surface Timer    contacts:search
    Input Text    ${CONTACTS_SEARCH_INPUT}    Stress contact ${last}
    ${found}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${last_row}    timeout=${STRESS_TIMEOUT}
    ${gone}=    Run Keyword And Return Status
    ...    Wait Until Page Does Not Contain Element    ${first_row}    timeout=${STRESS_TIMEOUT}
    Stop Surface Timer    contacts:search    timed_out=${{not ($found and $gone)}}

Measure Until Visible
    [Documentation]    Time from now until the locator appears, or until the timeout, which counts as
    ...                the target never having appeared. Returns the verdict.
    [Arguments]    ${surface}    ${locator}    ${timeout}=${STRESS_TIMEOUT}
    Start Surface Timer    ${surface}
    ${found}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${locator}    timeout=${timeout}
    ${verdict}=    Stop Surface Timer    ${surface}    timed_out=${{not $found}}
    RETURN    ${verdict}

Measure Tap Until Visible
    [Arguments]    ${surface}    ${tap_locator}    ${locator}
    Wait Until Page Contains Element    ${tap_locator}    timeout=${STRESS_TIMEOUT}
    Start Surface Timer    ${surface}
    Click Element    ${tap_locator}
    ${found}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${locator}    timeout=${STRESS_TIMEOUT}
    ${verdict}=    Stop Surface Timer    ${surface}    timed_out=${{not $found}}
    RETURN    ${verdict}

Measure Scroll Run
    [Documentation]    Swipes the screen's list a fixed number of times. Frame counters (Android) and
    ...                the slowest swipe are recorded as readings, not as a timing: the swipes' own
    ...                duration would swamp any limit. A swipe that hangs fails the case.
    [Arguments]    ${surface}    ${swipes}=${SCROLL_SWIPES}
    Reset Frame Stats
    VAR    ${worst}    ${0}
    FOR    ${i}    IN RANGE    ${swipes}
        ${t0}=    Evaluate    time.perf_counter()    modules=time
        Swipe By Percent    50    75    50    25    ${SWIPE_MS}
        ${t1}=    Evaluate    time.perf_counter()    modules=time
        ${ms}=    Evaluate    round(($t1 - $t0) * 1000)
        IF    ${ms} > ${worst}    VAR    ${worst}    ${ms}
    END
    ${stats}=    Read Frame Stats
    Record Surface Sample    ${surface}    swipes=${swipes}    worst_swipe_ms=${worst}    &{stats}
    ${kb}=    Read Memory Kb
    IF    $kb is not None    Record Surface Sample    ${surface}:memory    pss_kb=${kb}

Count Switcher Accounts
    [Documentation]    Scrolls the open switcher until two swipes in a row bring no new row, and returns
    ...                how many distinct accounts it met. Rows are virtualized, so one read sees a screenful.
    Reset Frame Stats
    @{seen}=    Create List
    VAR    ${stale}    ${0}
    FOR    ${i}    IN RANGE    400
        @{rows}=    accounts.Switcher Addresses
        ${before}=    Get Length    ${seen}
        FOR    ${address}    IN    @{rows}
            IF    $address not in $seen    Append To List    ${seen}    ${address}
        END
        ${after}=    Get Length    ${seen}
        IF    ${after} == ${before}
            VAR    ${stale}    ${stale + 1}
        ELSE
            VAR    ${stale}    ${0}
        END
        IF    ${stale} >= 2    BREAK
        Swipe By Percent    50    75    50    25    ${SWIPE_MS}
    END
    ${stats}=    Read Frame Stats
    Record Surface Sample    switcher:scroll    accounts_seen=${after}    &{stats}
    RETURN    ${after}

Connect Many WC Sessions
    [Arguments]    ${count}
    FOR    ${i}    IN RANGE    ${count}
        Start Surface Timer    wc:connect
        Connect WC Session
        Stop Surface Timer    wc:connect
    END

Clear All WC Sessions
    Tap If Present    ${WC_CLEAR_ALL_BUTTON}
    Tap If Present    ${WC_DELETE_ALL_CONFIRM}
