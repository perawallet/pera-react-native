*** Settings ***
Documentation       The Fund tab: the age-gated onramp screen with a one-time introduction, then the
...                 buy form (mainnet only). Purchases are KYC- and payment-gated and not automated.
Resource            discover.resource


*** Variables ***
${FUND_TAB}                     accessibility_id=Fund
${ONRAMP_INTRO_START}           accessibility_id=onramp-intro-start-button
${ONRAMP_TAB_FUND}              accessibility_id=onramp-tab-fund
${ONRAMP_TAB_HISTORY}           accessibility_id=onramp-tab-history
${ONRAMP_COUNTRY_CHIP}          accessibility_id=onramp-country-chip
# Rendered on the history page only; the pager keeps both pages mounted, so visibility is the signal.
${ONRAMP_HISTORY_FILTER_ALL}    accessibility_id=onramp-history-filter-all


*** Keywords ***
Open Fund Tab
    Open Past Age Gate    ${FUND_TAB}    ${ONRAMP_TAB_FUND}    also_dismiss=${ONRAMP_INTRO_START}

Acknowledge Onramp Introduction
    [Documentation]    The one-time introduction opens once the Fund screen knows its chain, which can
    ...                be after the screen is up (iOS lists the pager behind the sheet), and then lands
    ...                over whatever the case does next. Seeing it once here keeps it out of the cases.
    Go Home
    Open Fund Tab
    Tap If Shown    ${ONRAMP_INTRO_START}    3s
    Go Home

History Page Should Be Off Screen
    [Documentation]    Off-screen pager pages leave the Android tree but stay in the iOS tree as hidden.
    ${shown}=    Run Keyword And Return Status    Element Should Be Visible    ${ONRAMP_HISTORY_FILTER_ALL}
    Should Not Be True    ${shown}    The history page is still showing.
