import type { AgentTurn, CaptionTurn, SessionSummary } from "@/types/mvp";
import type { Lang } from "@/i18n/translations";

const EMPTY_COPY: Record<
  Lang,
  {
    category: string;
    finalSummary: string;
    nextAction: string;
  }
> = {
  ko: {
    category: "대화 내용 없음",
    finalSummary: "상담사 응답이나 민원인 발화가 기록되지 않은 채 상담이 종료되었습니다.",
    nextAction: "별도의 후속 조치는 필요하지 않습니다.",
  },
  ja: {
    category: "通話内容なし",
    finalSummary: "発話や応答が記録されないまま通話が終了しました。",
    nextAction: "追加対応は不要です。",
  },
  en: {
    category: "No conversation",
    finalSummary:
      "The call ended without any caller utterances or agent responses being recorded.",
    nextAction: "No follow-up is needed.",
  },
};

/**
 * Summary shown when a session is ended with zero captions and zero agent
 * turns. Used to avoid leaking hardcoded mock-demo content when the real
 * backend has nothing to summarize.
 */
export function buildEmptySummary(
  sessionId: string,
  durationSeconds: number,
  lang: Lang = "en"
): SessionSummary {
  const copy = EMPTY_COPY[lang];
  return {
    sessionId,
    durationSeconds,
    complaintCategory: copy.category,
    coreDemands: [],
    agentResponses: [],
    detectedAbuseTypes: [],
    finalSummary: copy.finalSummary,
    recommendedNextAction: copy.nextAction,
  };
}

const LOCAL_COPY: Record<
  Lang,
  {
    category: string;
    finalSummary: (utteranceCount: number) => string;
    nextAction: string;
  }
> = {
  ko: {
    category: "상담 기록",
    finalSummary: (n) =>
      `이번 상담에서 ${n}건의 발화가 기록되었습니다. 상세 분석은 생성되지 않았습니다.`,
    nextAction: "필요 시 원본 대화 기록을 검토하세요.",
  },
  ja: {
    category: "通話記録",
    finalSummary: (n) =>
      `今回の通話で ${n} 件の発話が記録されました。詳細分析は生成されていません。`,
    nextAction: "必要に応じて原文記録をご確認ください。",
  },
  en: {
    category: "Call record",
    finalSummary: (n) =>
      `${n} utterance${n === 1 ? "" : "s"} were recorded in this call. Detailed analysis was not generated.`,
    nextAction: "Review the raw transcript if follow-up is needed.",
  },
};

/**
 * Summary fallback when the backend's /end endpoint fails but the local
 * session has captured at least one caller utterance or agent reply. We use
 * what we already have on the client (no LLM analysis) instead of leaking
 * the demo `buildMockSummary` hardcoded copy.
 */
export function buildLocalSummary(
  sessionId: string,
  durationSeconds: number,
  captions: CaptionTurn[],
  agentTurns: AgentTurn[],
  lang: Lang = "en"
): SessionSummary {
  const copy = LOCAL_COPY[lang];
  const coreDemands = Array.from(
    new Set(captions.map((c) => c.coreDemand).filter((x): x is string => !!x))
  );
  const agentResponses = agentTurns.map((a) => a.rawText).filter(Boolean);
  const detectedAbuseTypes = Array.from(
    new Set(captions.flatMap((c) => c.detectedAbuseTypes ?? []).filter(Boolean))
  );
  const utteranceCount = captions.length + agentTurns.length;
  return {
    sessionId,
    durationSeconds,
    complaintCategory: coreDemands[0] ?? copy.category,
    coreDemands,
    agentResponses,
    detectedAbuseTypes,
    finalSummary: copy.finalSummary(utteranceCount),
    recommendedNextAction: copy.nextAction,
  };
}

const en = {
  complaintCategory: "Processing delay complaint",
  coreDemands: [
    "Status update on previous inquiry",
    "Explanation of processing delay",
    "Supervisor escalation request",
  ],
  agentResponses: [
    "Confirmed they would look up the case number and share the current status",
    "Confirmed they would check supervisor availability",
  ],
  detectedAbuseTypes: [
    "Strong pressuring language",
    "Possible threatening language",
    "Repeated complaint",
  ],
  finalSummary:
    "The citizen stated that their previous inquiry remains unresolved and requested both a status update and supervisor escalation. The agent confirmed they would look up the case number and walk the citizen through the current status and next steps.",
  recommendedNextAction:
    "Save the conversation record and route to a supervisor for review if needed.",
};

const ko = {
  complaintCategory: "처리 지연 항의",
  coreDemands: [
    "이전 문의 건의 처리 현황 확인",
    "처리 지연 사유 설명",
    "상급자 연결 요청",
  ],
  agentResponses: [
    "접수번호 확인 후 현재 처리 현황을 안내하겠다고 답변함",
    "상급자 연결 가능 여부를 확인하겠다고 답변함",
  ],
  detectedAbuseTypes: [
    "강한 압박성 표현",
    "위협성 표현 가능",
    "반복 항의",
  ],
  finalSummary:
    "민원인은 이전 문의 이후에도 처리가 지연되고 있다고 주장하며 처리 현황 확인과 상급자 연결을 요청했습니다. 상담사는 접수번호 확인 후 현재 처리 현황과 후속 절차를 안내하겠다고 응답했습니다.",
  recommendedNextAction:
    "대화 기록을 저장하고 필요 시 상급자 검토를 권장합니다.",
};

const ja = {
  complaintCategory: "処理遅延に関する苦情",
  coreDemands: [
    "前回問い合わせの進捗確認",
    "処理遅延の理由説明",
    "上司への取次ぎ要望",
  ],
  agentResponses: [
    "受付番号を確認したうえで現在の進捗をご案内すると回答",
    "上司の対応可否を確認すると回答",
  ],
  detectedAbuseTypes: [
    "強い圧迫表現",
    "威嚇的表現の可能性",
    "繰り返しの苦情",
  ],
  finalSummary:
    "市民は前回の問い合わせがまだ解決していないと主張し、進捗確認と上司への取次ぎを求めました。オペレーターは受付番号を確認し、現在の状況と今後の手順をご案内すると回答しました。",
  recommendedNextAction:
    "通話記録を保存し、必要に応じて上司の確認に回付することを推奨します。",
};

const SUMMARY: Record<Lang, typeof en> = { ko, ja, en };

export function buildMockSummary(
  sessionId: string,
  durationSeconds: number,
  lang: Lang = "en"
): SessionSummary {
  const s = SUMMARY[lang];
  return {
    sessionId,
    durationSeconds,
    complaintCategory: s.complaintCategory,
    coreDemands: s.coreDemands,
    agentResponses: s.agentResponses,
    detectedAbuseTypes: s.detectedAbuseTypes,
    finalSummary: s.finalSummary,
    recommendedNextAction: s.recommendedNextAction,
  };
}
