*** Settings ***
Documentation       Scale scenarios: the release app at one tier of stress-tiers.json, driven through the
...                 screens a user would use. Each case times what the user waits for and notes frame,
...                 memory and CPU readings where the platform has a command-line source; a crash, ANR
...                 or never-appearing screen becomes a hard failure. Run one tier per platform and
...                 compare with e2e/tools/stress_report.py.
Resource            ../resources/stress.resource

Suite Setup         Start Stress Session
Suite Teardown      Finish Stress Session
Test Teardown       Capture Failure Screenshot
Test Tags           stress    slow


*** Test Cases ***
Cold Start Reaches The Portfolio
    [Tags]    id:stress.startup.cold
    ${ms}=    Cold Start Ms
    IF    $ms is not None    Record Surface Time    startup:am-start    ${ms}
    Measure Relaunch To First Screen
    # A wallet with a PIN opens on the lock screen; typing the PIN is the tester's time, not the
    # app's, so it stays outside both timers. startup:portfolio is what the app needs after that.
    Unlock With Known Pins
    Measure Until Visible    startup:portfolio    ${ACCOUNT_PORTFOLIO}
    Wait Clear Of Startup Prompts
    # The sync that follows a launch is the load a user feels while the app looks idle.
    Sleep    60s
    ${cpu}=    Read Cpu Pct
    ${kb}=    Read Memory Kb
    IF    $cpu is not None or $kb is not None
        Record Surface Sample    startup:idle    cpu_pct=${cpu}    pss_kb=${kb}
    END

Account Switcher Opens And Scrolls
    [Tags]    id:stress.switcher
    Go Home
    Start Surface Timer    switcher:open
    accounts.Open Account Switcher
    Stop Surface Timer    switcher:open
    ${seen}=    Count Switcher Accounts
    ${expected}=    Expected Account Count
    # Exactly the tier's size: a wallet seeded for a bigger tier would otherwise pass as this one.
    Should Be Equal As Integers    ${seen}    ${expected}
    ...    The switcher listed ${seen} accounts but tier ${TIER} expects ${expected}. Use a phrase seeded for this tier only, and set STRESS_EXTRA_ACCOUNTS for any imported by hand.
    Go Home

Asset List Scrolls Sorts And Filters
    [Tags]    id:stress.assets
    Set Test Variable    ${FILTER_FLIPPED}    ${False}
    Go Home
    # Every run starts from the default sort and ends back on it, so runs compare.
    Apply Sort    ${SORT_DEFAULT}
    Go Home
    Wait Until Page Contains Element    ${MANAGE_ASSETS_BUTTON}    timeout=${STRESS_TIMEOUT}
    Measure Scroll Run    assets:scroll
    Go Home
    # The sort is done when the list has reordered, not when the sheet has closed.
    ${before}=    Visible Asset Row Ids
    Open Sort Sheet
    Tap    ${SORT_ALPHABETICAL}
    Start Surface Timer    assets:sort
    Tap    ${SORT_APPLY}
    ${reordered}=    Run Keyword And Return Status
    ...    Wait Until Keyword Succeeds    ${STRESS_TIMEOUT}    0.2s    Asset Rows Should Differ From    ${before}
    Stop Surface Timer    assets:sort    timed_out=${{not $reordered}}
    Go Home
    # Hiding zero balances changes nothing on screen when every holding has a balance, so this one
    # is the time for the sheet to close, and says so in its name.
    Open Filter Sheet
    Tap    ${FILTER_HIDE_ZERO}
    Set Test Variable    ${FILTER_FLIPPED}    ${True}
    Start Surface Timer    assets:filter-dismiss
    Tap    ${FILTER_APPLY}
    Wait Until Page Does Not Contain Element    ${FILTER_APPLY}    timeout=${STRESS_TIMEOUT}
    Stop Surface Timer    assets:filter-dismiss
    [Teardown]    Finish Assets Case

Nft Gallery Opens And Scrolls
    [Tags]    id:stress.nfts
    Go Home
    Measure Tap Until Visible    nfts:open    ${NFTS_TAB}    ${FIRST_COLLECTIBLE}
    Measure Scroll Run    nfts:scroll
    Go Home

History Opens And Scrolls
    [Tags]    id:stress.history
    Go Home
    Measure Tap Until Visible    history:open    ${HISTORY_TAB}    ${TX_ROW_ANY}
    Measure Scroll Run    history:scroll
    Go Home

Contacts Open Scroll And Search
    [Tags]    id:stress.contacts
    # Loading the fixture is the harness setting data up (a deeplink, a navigation reset and a fixed
    # settle), so it stays outside the timer. The measurement is a user opening a list that
    # already holds the contacts, from the menu.
    Start With Stress Contacts    ${STRESS_SIZES}[contacts]
    Go Home
    Tap    ${MENU_TAB}
    Measure Tap Until Visible    contacts:open    ${MENU_CONTACTS_BUTTON}    ${CONTACT_ROW_ANY}
    Measure Scroll Run    contacts:scroll
    Measure Contacts Search    ${STRESS_SIZES}[contacts]
    [Teardown]    Run Keywords    Dismiss Keyboard    AND    Load Fixture    contacts-empty
    ...    AND    Capture Failure Screenshot

WalletConnect Sessions Pile Up
    [Tags]    id:stress.wc.sessions    needs-wc-harness
    Skip If    not $WC_HARNESS_URL    WC_HARNESS_URL is not set; this case needs the dApp harness.
    Go Home
    Connect Many WC Sessions    ${STRESS_SIZES}[wcSessions]
    Start Surface Timer    wc:list-open
    Open WC Sessions From Settings
    Stop Surface Timer    wc:list-open
    Measure Scroll Run    wc:list-scroll
    Start Surface Timer    wc:clear-all
    Clear All WC Sessions
    Wait Until Page Does Not Contain Element    ${WC_SESSION_ITEM}    timeout=${STRESS_TIMEOUT}
    Stop Surface Timer    wc:clear-all
    [Teardown]    Clean Up WC Sessions

App Resumes From The Background
    [Tags]    id:stress.resume
    Go Home
    Background Application    5
    # The app may lock on resume. Wait until it is back, then say which screen it chose, and unlock
    # outside the timer so the measurement is the same with or without a PIN.
    Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=${STRESS_TIMEOUT}
    ${locked}=    Run Keyword And Return Status    Page Should Contain Element    ${PIN_PAD_KEY}
    Record Surface Sample    resume:lock-screen    locked=${locked}
    Unlock With Known Pins
    Measure Until Visible    resume:portfolio    ${ACCOUNT_PORTFOLIO}
