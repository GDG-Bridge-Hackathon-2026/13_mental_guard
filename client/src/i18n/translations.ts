export type Lang = "ko" | "ja" | "en";

export const SUPPORTED_LANGS: Lang[] = ["ko", "ja", "en"];

export const LANG_LABELS: Record<Lang, { code: string; label: string; native: string }> = {
  ko: { code: "KO", label: "Korean", native: "한국어" },
  ja: { code: "JA", label: "Japanese", native: "日本語" },
  en: { code: "EN", label: "English", native: "English" },
};

export const LANG_LOCALES: Record<Lang, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
};

export interface Dictionary {
  brand: {
    name: string;
  };
  nav: {
    home: string;
    agentConsole: string;
    loginSignup: string;
    logout: string;
    sessions: string;
    me: string;
    settings: string;
    about: string;
  };
  landing: {
    chip: string;
    headlineLine1: string;
    headlineLine2: string;
    headlineAccent: string;
    subtitleSignedIn: string;
    subtitleSignedOut: string;
    cta: string;
    signInHint: string;
    loginRequiredTitle: string;
    loginRequiredBody: string;
    loginRequiredCta: string;
    loginRequiredCancel: string;
  };
  history: {
    eyebrow: string;
    welcome: (name: string) => string;
    sub: string;
    demand: (n: number) => string;
    flag: (n: number) => string;
    note: string;
  };
  agent: {
    waitingTitle: string;
    waitingBody: string;
    acceptCall: string;
    callConnected: string;
    emptyTitle: string;
    emptyBody: string;
    nextUtterance: string;
    nextRemaining: (n: number, total: number) => string;
    callerSpeaking: string;
    endCall: string;
    summary: string;
    fullReport: string;
    newCall: string;
    showSummary: string;
    callEnded: string;
    viewFullReport: string;
  };
  status: {
    standby: string;
    onCall: string;
    ended: string;
  };
  bubble: {
    citizen: string;
    you: string;
    aiRefined: string;
    voiceSent: string;
    refining: string;
    myReply: string;
  };
  replies: {
    title: string;
    hint: string;
    sendAsVoice: string;
    emptyDisabled: string;
    emptyProcessing: string;
    emptyIdle: string;
    footnote: string;
  };
  sidebar: {
    callInfo: string;
    duration: string;
    utterances: string;
    keyPoints: string;
    keyPointsEmpty: string;
    detectedExpressions: string;
    footer: string;
  };
  summary: {
    eyebrow: string;
    durationLabel: (d: string) => string;
    keyDemands: string;
    agentResponses: string;
    agentResponsesEmpty: string;
    detected: string;
    final: string;
    nextAction: string;
    startNew: string;
    viewTranscript: string;
    loading: string;
    back: string;
  };
  dialog: {
    ended: string;
    duration: (d: string, n: number) => string;
    aboutTitle: string;
    recapTitle: (n: number) => string;
    recapEmpty: string;
    keyDemands: string;
    keyDemandsEmpty: string;
    yourResponses: string;
    detected: string;
    nextAction: string;
    startNewCall: string;
    close: string;
    viewFullReport: string;
  };
  transcript: {
    eyebrow: string;
    title: string;
    description: string;
    compareHeader: string;
    compareSubtitle: string;
    rawCol: string;
    refinedCol: string;
    refinedTag: string;
    citizen: string;
    agent: string;
    noRefined: string;
    backSummary: string;
    startNew: string;
    loading: string;
  };
  auth: {
    welcomeBack: string;
    createAccount: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    continue: string;
    haveAccount: string;
    newHere: string;
    login: string;
    signup: string;
    closeAria: string;
  };
  actions: {
    regenerate: string;
    regenerating: string;
    escalateMenu: string;
    escalateSupervisor: string;
    escalateTerminate: string;
    escalateLegal: string;
    escalateReasonPlaceholder: string;
    escalateSubmit: string;
    escalateRecorded: string;
    notesTitle: string;
    notesEmpty: string;
    notesPlaceholder: string;
    notesAdd: string;
    notesSaving: string;
    feedbackHelpful: string;
    feedbackWrong: string;
    feedbackCorrectionPlaceholder: string;
    feedbackSubmit: string;
    feedbackSaved: string;
    apiOffline: string;
    cancel: string;
  };
  health: {
    title: string;
    sessions: string;
    highRisk: string;
    filtered: string;
    recommendedBreak: (m: number) => string;
    empty: string;
  };
  admin: {
    title: string;
    subtitle: string;
    totalSessions: string;
    highRiskSessions: string;
    avgThreat: string;
    filteredCount: string;
    topIntents: string;
    distribution: string;
    forbidden: string;
    loading: string;
    refresh: string;
  };
  sessions: {
    title: string;
    subtitle: string;
    empty: string;
    filterStatus: string;
    filterClassification: string;
    filterAll: string;
    searchPlaceholder: string;
    pagePrev: string;
    pageNext: string;
    pageOf: (current: number, total: number) => string;
    columnCategory: string;
    columnStarted: string;
    columnDuration: string;
    columnTurns: string;
    columnClassification: string;
    columnAction: string;
    actionSummary: string;
    actionTranscript: string;
    actionTimeline: string;
    statusActive: string;
    statusEnded: string;
    statusOther: string;
  };
  settings: {
    title: string;
    accountTitle: string;
    accountSignedInAs: string;
    accountEmail: string;
    accountUserId: string;
    languageTitle: string;
    languageHint: string;
    sessionTitle: string;
    sessionLogout: string;
    sessionLogoutDescription: string;
    notSignedInTitle: string;
    notSignedInBody: string;
  };
  about: {
    title: string;
    leadTitle: string;
    leadBody: string;
    flowTitle: string;
    flowStepOneTitle: string;
    flowStepOneBody: string;
    flowStepTwoTitle: string;
    flowStepTwoBody: string;
    flowStepThreeTitle: string;
    flowStepThreeBody: string;
    flowStepFourTitle: string;
    flowStepFourBody: string;
    classificationTitle: string;
    classificationBody: string;
    classificationA: string;
    classificationB: string;
    classificationC: string;
    classificationD: string;
    classificationE: string;
    privacyTitle: string;
    privacyBody: string;
    ctaBack: string;
  };
  me: {
    title: string;
    subtitle: (name: string) => string;
    today: string;
    week: string;
    sessionsHandled: string;
    highRiskSessions: string;
    filteredAbuse: string;
    recommendedBreak: string;
    minutes: (m: number) => string;
    noBreak: string;
    recentSessions: string;
    seeAll: string;
    emptySessions: string;
    notSignedIn: string;
  };
  timeline: {
    title: string;
    subtitle: string;
    empty: string;
    sessionStatus: string;
    captionPartial: string;
    captionFinal: string;
    riskUpdate: string;
    thresholdWarning: string;
    thresholdTerminate: string;
    agentReply: string;
    sessionEnded: string;
    note: string;
    escalation: string;
    feedback: string;
    other: string;
    threatLevel: (level: number) => string;
    backToSummary: string;
    backToTranscript: string;
  };
  loading: {
    connecting: string;
    endingCall: string;
    fetchingSummary: string;
    fetchingTranscript: string;
    fetchingAnalytics: string;
  };
  caller: {
    headerTitle: string;
    statusPermission: string;
    statusReady: string;
    statusRecording: string;
    statusProcessing: string;
    statusEnded: string;
    statusError: string;
    grantMic: string;
    grantMicHint: string;
    startTalk: string;
    stopTalk: string;
    submitting: string;
    sent: string;
    waitingAgent: string;
    httpsWarning: string;
    safariWarning: string;
    sessionInvalid: string;
    again: string;
    helperSpeakNow: string;
    helperTapWhenDone: string;
  };
  qr: {
    title: string;
    body: string;
    urlLabel: string;
    copy: string;
    copied: string;
    close: string;
    showAgain: string;
    waitingCaller: string;
  };
}
