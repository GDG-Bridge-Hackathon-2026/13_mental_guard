import speech, { protos } from '@google-cloud/speech';
import { env } from './env.js';
import { ApiError } from './errors.js';
import { Language } from '@prisma/client';

const client = new speech.SpeechClient({
  projectId: env.GCS_PROJECT_ID,
  credentials: {
    client_email: env.GCS_CLIENT_EMAIL,
    private_key: env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

type Encoding = protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;
const ENCODING_MAP: Record<string, Encoding> = {
  WEBM_OPUS: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.WEBM_OPUS,
  OGG_OPUS: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.OGG_OPUS,
  LINEAR16: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
  MP3: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.MP3,
  FLAC: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.FLAC,
  ENCODING_UNSPECIFIED:
    protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,
};

export interface TranscribeResult {
  text: string;
  confidence: number;
  detected_language: string;
}

type RecognizeResult = protos.google.cloud.speech.v1.ISpeechRecognitionResult;
type StreamingResponse = protos.google.cloud.speech.v1.IStreamingRecognizeResponse;

const SYNC_LIMIT_MS = 55_000;

interface SttOptions {
  language_hint?: Language;
  sample_rate?: number;
  encoding?: keyof typeof ENCODING_MAP;
  duration_ms?: number;
}

const LANGUAGE_CODE: Record<Exclude<Language, 'AUTO'>, string> = {
  KO: 'ko-KR',
  JA: 'ja-JP',
  EN: 'en-US',
};
const AUTO_LANGUAGE_CODES = Object.values(LANGUAGE_CODE);

function buildConfig(options?: SttOptions): {
  config: protos.google.cloud.speech.v1.IRecognitionConfig;
  languageCode: string;
} {
  const languageCode =
    options?.language_hint && options.language_hint !== Language.AUTO
      ? LANGUAGE_CODE[options.language_hint]
      : env.GCP_STT_LANGUAGE;
  const alternativeLanguageCodes =
    options?.language_hint === Language.AUTO
      ? AUTO_LANGUAGE_CODES.filter((code) => code !== languageCode)
      : undefined;
  const encoding = ENCODING_MAP[options?.encoding ?? env.GCP_STT_ENCODING];
  const sampleRateHertz = options?.sample_rate ?? env.GCP_STT_SAMPLE_RATE;
  return {
    config: {
      encoding,
      sampleRateHertz,
      languageCode,
      alternativeLanguageCodes,
      enableAutomaticPunctuation: true,
      model: 'default',
    },
    languageCode,
  };
}

// ── 동기 / 장시간 (REST 업로드 경로) ──────────────────────────────────────

export async function transcribeAudio(
  audio: Buffer,
  options?: SttOptions
): Promise<TranscribeResult> {
  const { config, languageCode } = buildConfig(options);
  const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
    audio: { content: audio.toString('base64') },
    config,
  };
  const useLong = (options?.duration_ms ?? 0) > SYNC_LIMIT_MS;
  try {
    return useLong
      ? await recognizeLong(request, languageCode)
      : await recognizeSync(request, languageCode);
  } catch (e) {
    if (!useLong && /exceeds duration limit|too long/i.test(String(e))) {
      console.warn('[stt] sync rejected, retrying with longRunningRecognize');
      return recognizeLong(request, languageCode);
    }
    throw new ApiError(500, 'STT_FAILED', `gcp stt failed: ${String(e)}`);
  }
}

async function recognizeSync(
  request: protos.google.cloud.speech.v1.IRecognizeRequest,
  fallbackLang: string
): Promise<TranscribeResult> {
  const [response] = await client.recognize(request, { timeout: env.GCP_STT_TIMEOUT_MS });
  return shapeResult(response.results ?? [], fallbackLang);
}

async function recognizeLong(
  request: protos.google.cloud.speech.v1.IRecognizeRequest,
  fallbackLang: string
): Promise<TranscribeResult> {
  const [operation] = await client.longRunningRecognize(request);
  const [response] = await operation.promise();
  return shapeResult(response.results ?? [], fallbackLang);
}

function shapeResult(results: RecognizeResult[], fallbackLang: string): TranscribeResult {
  if (results.length === 0) return { text: '', confidence: 0, detected_language: fallbackLang };
  const text = results
    .map((r) => r.alternatives?.[0]?.transcript ?? '')
    .join(' ')
    .trim();
  const confidence = results[0]?.alternatives?.[0]?.confidence ?? 0;
  const detected =
    (results[0] as { languageCode?: string } | undefined)?.languageCode ?? fallbackLang;
  return { text, confidence, detected_language: detected };
}

// ── 스트리밍 (WS caller-audio 경로) ───────────────────────────────────────

export interface StreamingHandle {
  /** 청크를 GCP에 push. 비차단. */
  write(chunk: Buffer): void;
  /** interim transcript 콜백 등록 (여러 번 호출됨). */
  onPartial(listener: (text: string) => void): void;
  /** 스트림 에러 (네트워크, 5분 초과 등). */
  onError(listener: (err: Error) => void): void;
  /** audio.end 시 호출. 최종 transcript로 resolve. */
  close(): Promise<TranscribeResult>;
  /** 즉시 폐기 (WS 끊김 등). 최종 결과 버림. */
  abort(): void;
}

/**
 * GCP Streaming Recognize 한 발화 단위 핸들 생성.
 *
 * 정책 (memory project_websocket.md 참조):
 *   - audio.chunk 들어올 때 createTranscribeStream() 호출 (발화 시작)
 *   - 각 chunk마다 write()
 *   - audio.end 시 close() → 최종 transcript
 *   - GCP 5분 제한은 발화 단위 정책으로 자연 회피 (한 발화가 5분 넘어가는 케이스만 위험)
 */
export function createTranscribeStream(options?: SttOptions): StreamingHandle {
  const { config, languageCode } = buildConfig(options);

  const recognizeStream = client.streamingRecognize({
    config,
    interimResults: true,
    singleUtterance: false,
  });

  const finalSegments: string[] = [];
  let finalConfidence = 0;
  let detectedLang = languageCode;
  const partialListeners: Array<(text: string) => void> = [];
  const errorListeners: Array<(err: Error) => void> = [];

  let resolveEnd!: (r: TranscribeResult) => void;
  let rejectEnd!: (e: Error) => void;
  const endPromise = new Promise<TranscribeResult>((res, rej) => {
    resolveEnd = res;
    rejectEnd = rej;
  });
  endPromise.catch(() => {
    // The caller may not await close() until audio.end; keep early stream
    // errors from surfacing as unhandled rejections before then.
  });
  let aborted = false;

  recognizeStream.on('data', (data: StreamingResponse) => {
    const result = data.results?.[0];
    if (!result) return;
    const transcript = result.alternatives?.[0]?.transcript ?? '';
    if (!transcript) return;

    if (result.isFinal) {
      finalSegments.push(transcript);
      const c = result.alternatives?.[0]?.confidence;
      if (typeof c === 'number' && c > finalConfidence) finalConfidence = c;
      const langGuess = (result as { languageCode?: string }).languageCode;
      if (langGuess) detectedLang = langGuess;
    } else {
      // interim — 지금까지 확정된 final + 현재 interim 합쳐서 표시용 텍스트
      const current = [...finalSegments, transcript].join(' ').trim();
      for (const l of partialListeners) {
        try { l(current); } catch (e) { console.error('[stt partial listener]', e); }
      }
    }
  });

  recognizeStream.on('error', (err: Error) => {
    for (const l of errorListeners) {
      try { l(err); } catch (e) { console.error('[stt error listener]', e); }
    }
    if (!aborted) rejectEnd(err);
  });

  recognizeStream.on('end', () => {
    if (aborted) return;
    resolveEnd({
      text: finalSegments.join(' ').trim(),
      confidence: finalConfidence,
      detected_language: detectedLang,
    });
  });

  return {
    write(chunk: Buffer) {
      if (aborted) return;
      recognizeStream.write(chunk);
    },
    onPartial(listener) { partialListeners.push(listener); },
    onError(listener) { errorListeners.push(listener); },
    close() {
      if (aborted) return Promise.resolve({ text: '', confidence: 0, detected_language: detectedLang });
      recognizeStream.end();
      return endPromise;
    },
    abort() {
      aborted = true;
      try { recognizeStream.destroy(); } catch { /* noop */ }
    },
  };
}
