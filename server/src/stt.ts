import speech, { protos } from '@google-cloud/speech';
import { env } from './env.js';
import { ApiError } from './errors.js';

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
  confidence: number; // 0~1
  detected_language: string;
}

type RecognizeResult = protos.google.cloud.speech.v1.ISpeechRecognitionResult;

/**
 * 버퍼된 음성 → 텍스트.
 * 짧은 발화(<1분) recognize 동기 API 사용. 1분 이상은 longRunningRecognize로 교체 필요.
 */
export async function transcribeAudio(
  audio: Buffer,
  options?: {
    language_hint?: 'KO' | 'JA' | 'AUTO';
    sample_rate?: number;
    encoding?: keyof typeof ENCODING_MAP;
  }
): Promise<TranscribeResult> {
  const languageCode =
    options?.language_hint === 'JA'
      ? 'ja-JP'
      : options?.language_hint === 'KO'
        ? 'ko-KR'
        : env.GCP_STT_LANGUAGE;

  const encoding = ENCODING_MAP[options?.encoding ?? env.GCP_STT_ENCODING];
  const sampleRateHertz = options?.sample_rate ?? env.GCP_STT_SAMPLE_RATE;

  const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
    audio: { content: audio.toString('base64') },
    config: {
      encoding,
      sampleRateHertz,
      languageCode,
      alternativeLanguageCodes:
        options?.language_hint === 'AUTO' ? ['ja-JP', 'ko-KR'] : undefined,
      enableAutomaticPunctuation: true,
      model: 'default',
    },
  };

  try {
    // GAX CallOptions: timeout만 사용 (signal 미지원)
    const [response] = await client.recognize(request, {
      timeout: env.GCP_STT_TIMEOUT_MS,
    });
    const results: RecognizeResult[] = response.results ?? [];
    if (results.length === 0) {
      return { text: '', confidence: 0, detected_language: languageCode };
    }
    const text = results
      .map((r: RecognizeResult) => r.alternatives?.[0]?.transcript ?? '')
      .join(' ')
      .trim();
    const confidence = results[0]?.alternatives?.[0]?.confidence ?? 0;
    const detected =
      (results[0] as { languageCode?: string } | undefined)?.languageCode ?? languageCode;
    return { text, confidence, detected_language: detected };
  } catch (e) {
    throw new ApiError(500, 'STT_FAILED', `gcp stt failed: ${String(e)}`);
  }
}