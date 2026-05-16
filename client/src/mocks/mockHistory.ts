import type { SessionSummary } from "@/types/mvp";
import type { Lang } from "@/i18n/translations";

export interface HistoryEntry {
  sessionId: string;
  endedAt: string; // ISO
  summary: SessionSummary;
}

const en: HistoryEntry[] = [
  {
    sessionId: "hist_001",
    endedAt: "2026-05-14T15:24:00Z",
    summary: {
      sessionId: "hist_001",
      durationSeconds: 312,
      complaintCategory: "Processing delay complaint",
      coreDemands: [
        "Status update on previous inquiry",
        "Explanation of processing delay",
        "Supervisor escalation request",
      ],
      agentResponses: [
        "Confirmed they would look up the case number and share the current status",
        "Offered to arrange a callback once the supervisor was free",
      ],
      detectedAbuseTypes: [
        "Strong pressuring language",
        "Possible threatening language",
        "Repeated complaint",
      ],
      finalSummary:
        "The citizen stated their previous inquiry remained unresolved and requested both a status update and supervisor escalation. The agent confirmed they would look up the case number and walk the citizen through the current status and next steps.",
      recommendedNextAction:
        "Save the conversation record and route to a supervisor for review if needed.",
    },
  },
  {
    sessionId: "hist_002",
    endedAt: "2026-05-12T09:05:00Z",
    summary: {
      sessionId: "hist_002",
      durationSeconds: 184,
      complaintCategory: "Refund request",
      coreDemands: [
        "Confirmation of overcharge on water bill",
        "Refund of the disputed amount",
      ],
      agentResponses: [
        "Confirmed the billing discrepancy and started a refund request",
        "Provided the expected refund timeline of 5–7 business days",
      ],
      detectedAbuseTypes: ["Mild dissatisfaction"],
      finalSummary:
        "The citizen reported being overcharged on their water bill and requested a refund. The agent verified the overcharge in the billing system and initiated the refund process.",
      recommendedNextAction:
        "Send a written refund confirmation to the citizen by email within 24 hours.",
    },
  },
  {
    sessionId: "hist_003",
    endedAt: "2026-05-09T18:42:00Z",
    summary: {
      sessionId: "hist_003",
      durationSeconds: 478,
      complaintCategory: "Repeated noise complaint",
      coreDemands: [
        "Onsite inspection of the noise source",
        "Enforcement against the responsible party",
        "Written response to the previous complaint",
      ],
      agentResponses: [
        "Acknowledged the recurring complaint and committed to dispatching an inspector this week",
        "Promised to follow up in writing within 3 business days",
      ],
      detectedAbuseTypes: [
        "Strong pressuring language",
        "Repeated complaint",
        "Frustration",
      ],
      finalSummary:
        "The citizen reported repeated late-night noise from a neighboring building and demanded enforcement action plus a formal written reply. The agent committed to dispatching an inspector and issuing a written follow-up.",
      recommendedNextAction:
        "Coordinate with the inspection team and ensure the written follow-up is delivered on time.",
    },
  },
  {
    sessionId: "hist_004",
    endedAt: "2026-05-06T11:18:00Z",
    summary: {
      sessionId: "hist_004",
      durationSeconds: 96,
      complaintCategory: "General service inquiry",
      coreDemands: [
        "Operating hours of the local office",
        "Required documents for a residence certificate",
      ],
      agentResponses: [
        "Provided current operating hours including the lunch break",
        "Listed the required ID and supporting documents",
      ],
      detectedAbuseTypes: [],
      finalSummary:
        "The citizen called to confirm the local office's operating hours and the documents required for issuing a residence certificate. The agent answered both questions directly.",
      recommendedNextAction:
        "No follow-up needed. Inquiry resolved within the call.",
    },
  },
];

const ko: HistoryEntry[] = [
  {
    sessionId: "hist_001",
    endedAt: "2026-05-14T15:24:00Z",
    summary: {
      sessionId: "hist_001",
      durationSeconds: 312,
      complaintCategory: "처리 지연 항의",
      coreDemands: [
        "이전 문의 건의 처리 현황 확인",
        "처리 지연 사유 설명",
        "상급자 연결 요청",
      ],
      agentResponses: [
        "접수번호 확인 후 현재 처리 현황을 안내하겠다고 답변함",
        "상급자가 가능해지면 콜백을 안내하겠다고 답변함",
      ],
      detectedAbuseTypes: ["강한 압박성 표현", "위협성 표현 가능", "반복 항의"],
      finalSummary:
        "민원인은 이전 문의 이후에도 처리가 지연되고 있다고 주장하며 처리 현황 확인과 상급자 연결을 요청했습니다. 상담사는 접수번호 확인 후 현재 처리 현황과 후속 절차를 안내하겠다고 응답했습니다.",
      recommendedNextAction:
        "대화 기록을 저장하고 필요 시 상급자 검토를 권장합니다.",
    },
  },
  {
    sessionId: "hist_002",
    endedAt: "2026-05-12T09:05:00Z",
    summary: {
      sessionId: "hist_002",
      durationSeconds: 184,
      complaintCategory: "환불 요청",
      coreDemands: ["수도 요금 과다 청구 확인", "이의 제기 금액 환불"],
      agentResponses: [
        "청구 오류를 확인하고 환불 신청을 접수함",
        "환불 예상 소요 기간은 영업일 기준 5~7일임을 안내함",
      ],
      detectedAbuseTypes: ["약한 불만 표현"],
      finalSummary:
        "민원인은 수도 요금이 과다 청구되었다고 신고하며 환불을 요청했습니다. 상담사는 청구 시스템에서 과다 청구를 확인하고 환불 절차를 시작했습니다.",
      recommendedNextAction:
        "24시간 내에 이메일로 환불 확인서를 발송할 것을 권장합니다.",
    },
  },
  {
    sessionId: "hist_003",
    endedAt: "2026-05-09T18:42:00Z",
    summary: {
      sessionId: "hist_003",
      durationSeconds: 478,
      complaintCategory: "소음 반복 민원",
      coreDemands: [
        "소음 발생지 현장 점검",
        "원인 측에 대한 조치",
        "이전 민원에 대한 서면 회신",
      ],
      agentResponses: [
        "반복 민원임을 인지하고 금주 내 점검자 파견을 약속함",
        "영업일 3일 이내 서면 회신을 약속함",
      ],
      detectedAbuseTypes: ["강한 압박성 표현", "반복 항의", "분노 표출"],
      finalSummary:
        "민원인은 인접 건물에서 발생하는 야간 소음을 반복적으로 신고하며 조치와 서면 회신을 요구했습니다. 상담사는 점검자 파견과 서면 회신을 약속했습니다.",
      recommendedNextAction:
        "점검팀과 일정을 조율하고, 서면 회신이 기한 내 전달되도록 관리하세요.",
    },
  },
  {
    sessionId: "hist_004",
    endedAt: "2026-05-06T11:18:00Z",
    summary: {
      sessionId: "hist_004",
      durationSeconds: 96,
      complaintCategory: "일반 안내 문의",
      coreDemands: [
        "지역 사무소 운영 시간 안내",
        "주민등록등본 발급 시 필요 서류",
      ],
      agentResponses: [
        "점심시간을 포함한 현재 운영 시간을 안내함",
        "필요한 신분증 및 보조 서류 목록을 안내함",
      ],
      detectedAbuseTypes: [],
      finalSummary:
        "민원인은 지역 사무소의 운영 시간과 주민등록등본 발급 시 필요한 서류를 확인하기 위해 전화하였습니다. 상담사는 두 가지 질문에 직접 답변하였습니다.",
      recommendedNextAction: "추가 조치 불필요. 통화 중에 문의가 해결되었습니다.",
    },
  },
];

const ja: HistoryEntry[] = [
  {
    sessionId: "hist_001",
    endedAt: "2026-05-14T15:24:00Z",
    summary: {
      sessionId: "hist_001",
      durationSeconds: 312,
      complaintCategory: "処理遅延に関する苦情",
      coreDemands: [
        "前回問い合わせの進捗確認",
        "処理遅延の理由説明",
        "上司への取次ぎ要望",
      ],
      agentResponses: [
        "受付番号を確認したうえで現在の進捗をご案内すると回答",
        "上司の手が空き次第、折り返しのご連絡を案内",
      ],
      detectedAbuseTypes: ["強い圧迫表現", "威嚇的表現の可能性", "繰り返しの苦情"],
      finalSummary:
        "市民は前回の問い合わせが解決していないと主張し、進捗確認と上司への取次ぎを求めました。オペレーターは受付番号を確認したうえで、現在の進捗と今後の手順をご案内すると回答しました。",
      recommendedNextAction:
        "通話記録を保存し、必要に応じて上司の確認に回付することを推奨します。",
    },
  },
  {
    sessionId: "hist_002",
    endedAt: "2026-05-12T09:05:00Z",
    summary: {
      sessionId: "hist_002",
      durationSeconds: 184,
      complaintCategory: "返金請求",
      coreDemands: ["水道料金の過剰請求の確認", "対象金額の返金"],
      agentResponses: [
        "請求の誤りを確認し、返金手続きを開始",
        "返金までの目安は営業日5~7日と案内",
      ],
      detectedAbuseTypes: ["軽度の不満"],
      finalSummary:
        "市民は水道料金が過剰請求されていると申告し、返金を求めました。オペレーターは請求システムで過剰請求を確認し、返金手続きを開始しました。",
      recommendedNextAction:
        "24時間以内にメールで返金確認書を送付することを推奨します。",
    },
  },
  {
    sessionId: "hist_003",
    endedAt: "2026-05-09T18:42:00Z",
    summary: {
      sessionId: "hist_003",
      durationSeconds: 478,
      complaintCategory: "繰り返しの騒音苦情",
      coreDemands: [
        "騒音発生源の現地確認",
        "原因者への措置",
        "前回苦情に対する書面回答",
      ],
      agentResponses: [
        "繰り返しの苦情であることを認識し、今週中に調査員を派遣することを約束",
        "営業日3日以内に書面で回答することを約束",
      ],
      detectedAbuseTypes: ["強い圧迫表現", "繰り返しの苦情", "強い不満"],
      finalSummary:
        "市民は隣接建物からの夜間騒音を繰り返し申告し、措置と書面回答を要求しました。オペレーターは調査員の派遣と書面回答を約束しました。",
      recommendedNextAction:
        "調査チームと日程を調整し、書面回答が期日通り届くよう管理してください。",
    },
  },
  {
    sessionId: "hist_004",
    endedAt: "2026-05-06T11:18:00Z",
    summary: {
      sessionId: "hist_004",
      durationSeconds: 96,
      complaintCategory: "一般の問い合わせ",
      coreDemands: ["地域事務所の営業時間", "住民票発行に必要な書類"],
      agentResponses: [
        "昼休みを含めた現在の営業時間を案内",
        "必要な身分証および補助書類の一覧を案内",
      ],
      detectedAbuseTypes: [],
      finalSummary:
        "市民は地域事務所の営業時間と、住民票発行に必要な書類を確認するため電話しました。オペレーターは両方の質問に直接回答しました。",
      recommendedNextAction: "追加対応は不要。通話内で問い合わせが解決しました。",
    },
  },
];

const HISTORY: Record<Lang, HistoryEntry[]> = { ko, ja, en };

export function getMockHistory(lang: Lang): HistoryEntry[] {
  return HISTORY[lang];
}

export function findHistorySummary(
  sessionId: string,
  lang: Lang
): SessionSummary | null {
  return HISTORY[lang].find((h) => h.sessionId === sessionId)?.summary ?? null;
}
