// Swagger UI / curl 테스트용 Firebase ID 토큰 생성기.
//
// 사용:
//   npm run gen-token                                   # 기본 (uid=agent_test_001, role=AGENT)
//   npm run gen-token -- --uid admin_001 --role ADMIN   # 관리자 토큰
//   npm run gen-token -- -u super_001 -r SUPERVISOR -n "테스트 슈퍼바이저"
//
// 동작:
//   1. Firebase Auth에 user 존재 보장 (없으면 생성)
//   2. Prisma User 테이블에 upsert (지정된 role)
//   3. custom token 발급 → Identity Toolkit REST로 ID token 교환
//   4. stdout에 ID token 출력 → Swagger Authorize에 붙여넣기

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient, UserRole } from '@prisma/client';

const { values } = parseArgs({
  options: {
    uid: { type: 'string', short: 'u', default: 'agent_test_001' },
    email: { type: 'string', short: 'e' },
    name: { type: 'string', short: 'n' },
    role: { type: 'string', short: 'r', default: 'AGENT' },
  },
});

const uid = values.uid!;
const email = values.email ?? `${uid}@test.local`;
const displayName = values.name ?? `Test ${values.role}`;
const role = values.role!.toUpperCase() as UserRole;

if (!(role in UserRole)) {
  console.error(`Invalid role: ${values.role}. Use AGENT | SUPERVISOR | ADMIN`);
  process.exit(1);
}

const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
if (!WEB_API_KEY) {
  console.error('❌ FIREBASE_WEB_API_KEY missing in .env');
  console.error('   Firebase Console > Project Settings > General > "Web API Key" 에서 복사');
  process.exit(1);
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error('❌ FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY missing');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const auth = getAuth();
const prisma = new PrismaClient();

// 1. Firebase Auth user 확보
try {
  await auth.getUser(uid);
} catch {
  await auth.createUser({ uid, email, displayName });
  console.error(`✓ Firebase user created: ${uid}`);
}

// 2. DB User upsert (role 보장)
await prisma.user.upsert({
  where: { id: uid },
  update: { role, email, displayName },
  create: { id: uid, role, email, displayName },
});
console.error(`✓ DB User upserted: ${uid} (role=${role})`);

// 3. custom token → ID token 교환
const customToken = await auth.createCustomToken(uid, { role });

const resp = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);

if (!resp.ok) {
  console.error('❌ Token exchange failed:', resp.status, await resp.text());
  process.exit(1);
}

const data = (await resp.json()) as { idToken: string; expiresIn: string };
console.error(`✓ Token expires in ${data.expiresIn}s (~1h)`);
console.error('');
console.error('━━━ Swagger UI Authorize / curl Bearer ━━━');

// 토큰 본체만 stdout으로 (다른 메시지는 stderr) → 파이프 친화적
console.log(data.idToken);

console.error('');
console.error('curl 예시:');
console.error(
  `  curl -H "Authorization: Bearer <token>" http://localhost:${process.env.PORT ?? 4000}/api/sessions`
);

await prisma.$disconnect();