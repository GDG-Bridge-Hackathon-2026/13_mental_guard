import type { CaptionTurn } from "@/types/mvp";
import type { Lang } from "@/i18n/translations";

const en: CaptionTurn[] = [
  {
    id: "turn_001",
    seq: 1,
    speaker: "caller",
    rawText:
      "I called last week too — why hasn't this been processed yet? Are you people even doing your job?",
    cleanCaption:
      "The citizen states they contacted us last week as well and is asking for an update on a case that is still unresolved.",
    coreDemand: "Status update on previous inquiry",
    recommendedReplies: [
      {
        id: "rec_001_a",
        tone: "Apologetic",
        text: "We're sorry for the inconvenience. Let me look up your case number and check the current status right away.",
      },
      {
        id: "rec_001_b",
        tone: "Empathetic",
        text: "I understand the wait has been frustrating. Could you share a few details so I can find your case quickly?",
      },
      {
        id: "rec_001_c",
        tone: "Verify info",
        text: "If you can provide the reference number from your previous inquiry, I'll pull up the status right away.",
      },
    ],
    detectedAbuseTypes: ["Emphatic dissatisfaction", "Repeated complaint"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_002",
    seq: 2,
    speaker: "caller",
    rawText:
      "Get me someone else. Connect me to the manager. Doesn't this need to go up the chain?",
    cleanCaption:
      "The citizen is requesting to be transferred to a different agent or to a supervisor.",
    coreDemand: "Supervisor escalation request",
    recommendedReplies: [
      {
        id: "rec_002_a",
        tone: "Polite",
        text: "Let me check supervisor availability for you. Please bear with me for a moment.",
      },
      {
        id: "rec_002_b",
        tone: "Organize",
        text: "Before I transfer you, let's organize the case together. What concerns you the most right now?",
      },
      {
        id: "rec_002_c",
        tone: "Alternative",
        text: "If a supervisor isn't immediately available, we can arrange a callback. How would you like to proceed?",
      },
    ],
    detectedAbuseTypes: ["Pressuring language"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_003",
    seq: 3,
    speaker: "caller",
    rawText:
      "If this keeps up, I won't let it go. Do you think this is my first time being treated like this?",
    cleanCaption:
      "The citizen expresses strong dissatisfaction with the current handling and is demanding accountable follow-up.",
    coreDemand: "Accountable follow-up action",
    recommendedReplies: [
      {
        id: "rec_003_a",
        tone: "Empathetic",
        text: "I completely understand your frustration. Let me start by gathering the case details so we can move this forward.",
      },
      {
        id: "rec_003_b",
        tone: "Verify info",
        text: "To resolve this quickly, may I reconfirm your case number and contact details?",
      },
      {
        id: "rec_003_c",
        tone: "Escalation",
        text: "I'll escalate this to my supervisor right now and walk you through the next available steps.",
      },
    ],
    detectedAbuseTypes: ["Possible threatening language", "Strong pressuring language"],
    timestamp: new Date().toISOString(),
  },
];

const ko: CaptionTurn[] = [
  {
    id: "turn_001",
    seq: 1,
    speaker: "caller",
    rawText:
      "아니 내가 지난주에도 전화했는데 이걸 왜 아직도 처리가 안 됐냐고요? 일을 하는 거예요 마는 거예요?",
    cleanCaption:
      "민원인은 지난주에도 문의했지만 아직 해결되지 않은 건에 대해 처리 상황을 확인하고 있습니다.",
    coreDemand: "이전 문의 건의 처리 현황 확인",
    recommendedReplies: [
      {
        id: "rec_001_a",
        tone: "사과",
        text: "불편을 드려 죄송합니다. 접수번호를 확인한 뒤 처리 현황을 바로 안내드리겠습니다.",
      },
      {
        id: "rec_001_b",
        tone: "공감",
        text: "오래 기다리신 점 충분히 이해합니다. 접수 내용을 빠르게 찾을 수 있도록 몇 가지만 알려주실 수 있을까요?",
      },
      {
        id: "rec_001_c",
        tone: "정보 확인",
        text: "이전 문의 시 받으신 접수번호를 알려주시면 즉시 현황을 조회해 드리겠습니다.",
      },
    ],
    detectedAbuseTypes: ["강한 불만 표현", "반복 항의"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_002",
    seq: 2,
    speaker: "caller",
    rawText: "다른 사람 바꿔요. 책임자 연결해 주세요. 위로 안 올라가요?",
    cleanCaption: "민원인은 다른 상담사 또는 상급자로의 연결을 요청하고 있습니다.",
    coreDemand: "상급자 연결 요청",
    recommendedReplies: [
      {
        id: "rec_002_a",
        tone: "정중",
        text: "상급자 연결 가능 여부를 확인하겠습니다. 잠시만 기다려 주시겠어요?",
      },
      {
        id: "rec_002_b",
        tone: "정리",
        text: "연결 전에 현재 상황을 함께 정리해보면 좋을 것 같습니다. 가장 우선적으로 도와드릴 부분은 무엇인가요?",
      },
      {
        id: "rec_002_c",
        tone: "대안 제시",
        text: "상급자 연결이 즉시 어려운 경우 콜백을 예약해 드릴 수 있습니다. 어느 쪽이 편하실까요?",
      },
    ],
    detectedAbuseTypes: ["압박성 표현"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_003",
    seq: 3,
    speaker: "caller",
    rawText:
      "계속 이런 식이면 가만히 안 있을 겁니다. 이런 일 처음 당하는 줄 알아요?",
    cleanCaption:
      "민원인은 현재 처리 방식에 강한 불만을 표현하며 책임 있는 후속 조치를 요구하고 있습니다.",
    coreDemand: "책임 있는 후속 조치 요구",
    recommendedReplies: [
      {
        id: "rec_003_a",
        tone: "공감",
        text: "답답하신 마음 충분히 이해합니다. 빠르게 진행할 수 있도록 접수 내용부터 정리해 드리겠습니다.",
      },
      {
        id: "rec_003_b",
        tone: "정보 확인",
        text: "신속하게 해결을 위해 접수번호와 연락처를 다시 한번 확인해도 될까요?",
      },
      {
        id: "rec_003_c",
        tone: "상급자 연결",
        text: "지금 바로 상급자에게 보고드리고, 가능한 후속 절차를 안내드리겠습니다.",
      },
    ],
    detectedAbuseTypes: ["위협성 표현 가능", "강한 압박성 표현"],
    timestamp: new Date().toISOString(),
  },
];

const ja: CaptionTurn[] = [
  {
    id: "turn_001",
    seq: 1,
    speaker: "caller",
    rawText:
      "先週も電話したのに、なんでまだ処理されてないんですか?ちゃんと仕事してるんですか?",
    cleanCaption:
      "市民は先週も問い合わせており、未解決の案件について現在の進捗確認を求めています。",
    coreDemand: "前回問い合わせの進捗確認",
    recommendedReplies: [
      {
        id: "rec_001_a",
        tone: "謝罪",
        text: "ご不便をおかけして申し訳ありません。受付番号をお調べして、すぐに現在の状況をご案内いたします。",
      },
      {
        id: "rec_001_b",
        tone: "共感",
        text: "長らくお待たせしているお気持ちはよく分かります。受付内容を素早く確認するため、いくつか情報をお伺いしてもよろしいでしょうか。",
      },
      {
        id: "rec_001_c",
        tone: "情報確認",
        text: "前回の受付番号をお教えいただければ、すぐに状況をお調べいたします。",
      },
    ],
    detectedAbuseTypes: ["強い不満表現", "繰り返しの苦情"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_002",
    seq: 2,
    speaker: "caller",
    rawText: "他の人に代わってください。責任者を出してください。上に上げないんですか?",
    cleanCaption: "市民は別のオペレーターまたは上司への取次ぎを希望しています。",
    coreDemand: "上司への取次ぎ要望",
    recommendedReplies: [
      {
        id: "rec_002_a",
        tone: "丁寧",
        text: "上司の対応可否を確認いたします。少々お時間をいただいてもよろしいでしょうか。",
      },
      {
        id: "rec_002_b",
        tone: "整理",
        text: "お繋ぎする前に、現在の状況を一緒に整理させてください。最も気がかりな点はどちらでしょうか。",
      },
      {
        id: "rec_002_c",
        tone: "代替提案",
        text: "上司がすぐに対応できない場合、折り返しのご連絡も可能です。いずれがご都合よろしいでしょうか。",
      },
    ],
    detectedAbuseTypes: ["圧迫的な表現"],
    timestamp: new Date().toISOString(),
  },
  {
    id: "turn_003",
    seq: 3,
    speaker: "caller",
    rawText:
      "このまま続くなら黙ってませんよ。こんな扱いを受けるのは初めてだと思ってるんですか?",
    cleanCaption:
      "市民は現在の対応に強い不満を示し、責任ある後続対応を求めています。",
    coreDemand: "責任ある後続対応の要望",
    recommendedReplies: [
      {
        id: "rec_003_a",
        tone: "共感",
        text: "もどかしいお気持ちはよく分かります。早急に進められるよう、まず受付内容を整理させてください。",
      },
      {
        id: "rec_003_b",
        tone: "情報確認",
        text: "迅速に解決するため、受付番号とご連絡先を改めて確認させていただけますか。",
      },
      {
        id: "rec_003_c",
        tone: "上司エスカレーション",
        text: "ただ今上司に報告いたしまして、可能な次の手順をご案内いたします。",
      },
    ],
    detectedAbuseTypes: ["威嚇的表現の可能性", "強い圧迫表現"],
    timestamp: new Date().toISOString(),
  },
];

const TURNS: Record<Lang, CaptionTurn[]> = { ko, ja, en };

export function getMockCallerTurns(lang: Lang): CaptionTurn[] {
  return TURNS[lang];
}
