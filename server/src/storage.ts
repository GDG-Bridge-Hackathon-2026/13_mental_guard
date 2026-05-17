import { Storage } from '@google-cloud/storage';
import { env } from './env.js';
import { ApiError } from './errors.js';

const storage = new Storage({
  projectId: env.GCS_PROJECT_ID,
  credentials: {
    client_email: env.GCS_CLIENT_EMAIL,
    private_key: env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const bucket = storage.bucket(env.GCS_BUCKET);

// 객체 경로 prefix
const VOICE_PREFIX = 'voice';
const STT_PREFIX = 'stt';

function extFromMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

function publicUrl(objectPath: string): string {
  return `https://storage.googleapis.com/${env.GCS_BUCKET}/${encodeURI(objectPath)}`;
}

/**
 * 음성 원본을 `voice/{sessionId}/{turnId}.{ext}` 로 업로드.
 * 비공개 운영하려면 returned URL을 v4 signed URL로 교체.
 */
export async function uploadAudio(
  buffer: Buffer,
  sessionId: string,
  turnId: string,
  mime: string
): Promise<string> {
  const objectPath = `${VOICE_PREFIX}/${sessionId}/${turnId}.${extFromMime(mime)}`;
  const file = bucket.file(objectPath);

  try {
    await file.save(buffer, {
      contentType: mime,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0' },
    });
  } catch (e) {
    throw new ApiError(500, 'STORAGE_FAILED', `gcs upload (voice) failed: ${String(e)}`);
  }

  return publicUrl(objectPath);
}

/**
 * STT transcript 텍스트를 `stt/{sessionId}/{turnId}.txt` 로 업로드.
 * 실패 시 ApiError 던지지 않고 null 반환 — STT 실패가 턴 저장을 막으면 안 됨.
 */
export async function uploadTranscript(
  text: string,
  sessionId: string,
  turnId: string
): Promise<string | null> {
  const objectPath = `${STT_PREFIX}/${sessionId}/${turnId}.txt`;
  const file = bucket.file(objectPath);

  try {
    await file.save(Buffer.from(text, 'utf-8'), {
      contentType: 'text/plain; charset=utf-8',
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0' },
    });
    return publicUrl(objectPath);
  } catch (e) {
    console.warn('[uploadTranscript] failed (non-fatal)', String(e));
    return null;
  }
}