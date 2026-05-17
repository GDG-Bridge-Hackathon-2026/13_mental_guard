# Mental Guard

Mental Guard is an AI-assisted counseling safety platform for real-time civil complaint calls. It captures caller speech, runs speech-to-text and AI analysis, shows refined captions and risk signals to the agent, and generates post-call summaries for review.

## Repository Structure

```text
mental-guard/
  client/   Next.js agent/caller web app
  server/   Express + TypeScript API, WebSocket, Prisma, STT, Firebase Admin
  llm/      FastAPI Gemini analysis service
  docs/     API contracts and WebSocket notes
```

## Tech Stack

- Frontend: Next.js 14, React, Zustand, Firebase Auth
- Backend: Node.js 20, Express, WebSocket (`ws`), Prisma, PostgreSQL
- AI/ML: FastAPI, Gemini API
- Speech/Storage: Google Cloud Speech-to-Text, Google Cloud Storage
- Auth: Firebase Authentication and Firebase Admin SDK
- Deployment: Docker, GitHub Actions, VM deployment script

## Required Services

Before running the full real API flow, prepare:

- PostgreSQL database
- Firebase project with Google sign-in enabled
- Firebase Admin service account
- Google Cloud service account with Speech-to-Text and Storage permissions
- Google Cloud Storage bucket
- Gemini API key for the LLM service

For local UI-only work, you can run the client in mock mode by setting `NEXT_PUBLIC_USE_REAL_API=0`.

## Ports

| Service | Port | URL |
|---|---:|---|
| Client | 3000 | `http://localhost:3000` |
| Server | 4000 | `http://localhost:4000` |
| LLM | 5555 | `http://localhost:5555` |
| Swagger UI | 4000 | `http://localhost:4000/docs` |

## 1. Clone

```bash
git clone https://github.com/GDG-Bridge-Hackathon-2026/mental-guard.git
cd mental-guard
```

## 2. Environment Files

Do not commit real `.env` files. Use the examples below as templates.

### `server/.env`

```bash
cd server
cp .env.example .env
```

Fill in the values:

```env
PORT=4000
NODE_ENV=development

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public

GCS_PROJECT_ID=your-gcp-project-id
GCS_BUCKET=your-gcs-bucket
GCS_CLIENT_EMAIL=your-gcs-service-account@your-project.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nREPLACE_ME\n-----END PRIVATE KEY-----\n"

ML_SERVICE_URL=http://localhost:5555
ML_SERVICE_TIMEOUT_MS=15000

FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-admin-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nREPLACE_ME\n-----END PRIVATE KEY-----\n"

GCP_STT_LANGUAGE=ko-KR
GCP_STT_SAMPLE_RATE=48000
GCP_STT_ENCODING=WEBM_OPUS
GCP_STT_TIMEOUT_MS=10000

CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

For production, add the deployed frontend origin. Example:

```env
CORS_ORIGINS=https://mental-guard-client.duckdns.org,http://localhost:3000,http://localhost:3001
```

This allowlist is used by both REST CORS and WebSocket origin checks.

### `llm/.env`

```env
GEMINI_API_KEY=your-gemini-api-key
MODEL_NAME=gemini-2.5-flash-lite
```

### `client/.env.local`

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-web-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Browser-visible WebSocket base URL.
# Use ws:// for local HTTP, and wss:// for HTTPS deployments.
NEXT_PUBLIC_BACKEND_WSS_URL=ws://localhost:4000

# Optional. Used when generating caller QR links.
NEXT_PUBLIC_PUBLIC_URL=http://localhost:3000

# Optional. Set to 0 to run UI mock mode without real backend calls.
NEXT_PUBLIC_USE_REAL_API=1
```

Important: `NEXT_PUBLIC_*` values are embedded at Next.js build time. If you change them in Docker or production, rebuild the client image.

## 3. Database Setup

If you do not already have PostgreSQL, start one with Docker:

```bash
docker run --name mental-guard-postgres \
  -e POSTGRES_USER=mental_guard \
  -e POSTGRES_PASSWORD=mental_guard \
  -e POSTGRES_DB=mental_guard \
  -p 5432:5432 \
  -d postgres:16
```

Use this local `DATABASE_URL`:

```env
DATABASE_URL=postgresql://mental_guard:mental_guard@localhost:5432/mental_guard?schema=public
```

Then apply Prisma migrations:

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
```

## 4. Run Locally

Open three terminals.

### Terminal A: LLM

```bash
cd llm
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5555 --reload
```

On Windows PowerShell:

```powershell
cd llm
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5555 --reload
```

### Terminal B: Server

```bash
cd server
npm install
npm run dev
```

Check:

```bash
curl http://localhost:4000/health
```

Swagger UI:

```text
http://localhost:4000/docs
```

### Terminal C: Client

```bash
cd client
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 5. Firebase Setup

In Firebase Console:

1. Enable Authentication.
2. Enable Google sign-in provider.
3. Add authorized domains:
   - `localhost`
   - your deployed frontend domain, for example `mental-guard-client.duckdns.org`
4. Create a Firebase Admin service account and put its values in `server/.env`.
5. Copy the Web SDK config values into `client/.env.local`.

For Android Google sign-in, also add the Android app SHA-1 certificate fingerprint in Firebase project settings.

## 6. Google Cloud Setup

Enable these APIs:

- Cloud Speech-to-Text
- Cloud Storage

Create or choose a service account and grant the required permissions:

- Speech-to-Text access
- Storage object read/write access for the configured bucket

Put the service account email/private key in `server/.env`.

## 7. Docker

### Build and Run LLM

```bash
docker build -t mental-guard-llm:dev ./llm
docker run --rm --env-file ./llm/.env -p 5555:5555 mental-guard-llm:dev
```

### Build and Run Server

```bash
docker build -t mental-guard-server:dev ./server
docker run --rm \
  --env-file ./server/.env \
  --add-host=host.docker.internal:host-gateway \
  -p 4000:4000 \
  mental-guard-server:dev
```

If the server container needs to call a local LLM container through the host, set:

```env
ML_SERVICE_URL=http://host.docker.internal:5555
```

### Build and Run Client

```bash
docker build \
  --build-arg BACKEND_INTERNAL_URL=http://host.docker.internal:4000 \
  -t mental-guard-client:dev \
  ./client

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e BACKEND_INTERNAL_URL=http://host.docker.internal:4000 \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -p 3000:3000 \
  mental-guard-client:dev
```

Remember: Firebase and WSS `NEXT_PUBLIC_*` values must exist before `docker build`.

## 8. Production Notes

For HTTPS deployments:

```env
NEXT_PUBLIC_BACKEND_WSS_URL=wss://your-backend-domain
NEXT_PUBLIC_PUBLIC_URL=https://your-frontend-domain
CORS_ORIGINS=https://your-frontend-domain
```

Use `wss://`, not `ws://`, when the frontend is served over HTTPS. Otherwise the browser will block the WebSocket connection and the caller page will fall back to REST upload.

## 9. GitHub Actions Dev Deploy

The dev deployment workflow is:

```text
.github/workflows/deploy-dev.yaml
```

It runs on pushes to `dev` and rebuilds only changed services:

- `server/**` -> server container on port 4000
- `llm/**` -> LLM container on port 5555
- `client/**` -> client container on port 3000

Required repository secrets:

```text
VM_HOST
VM_USER
VM_SSH_KEY
VM_REPO_PATH
CLIENT_BACKEND_INTERNAL_URL
```

`VM_REPO_PATH` should be an absolute path, for example:

```text
/home/ubuntu/mental-guard
```

## 10. Smoke Test

After all services are running:

1. Open `http://localhost:3000`.
2. Sign in with Google.
3. Start a demo session.
4. Open the caller QR link in another browser/device.
5. Grant microphone permission.
6. Speak and stop recording.
7. Confirm that the agent screen receives:
   - caller speaking indicator
   - live/processed caption
   - risk update
   - recommended replies

## Troubleshooting

### `Firebase is not configured`

The client build did not receive `NEXT_PUBLIC_FIREBASE_*` values. Add them to `client/.env.local` and rebuild/restart the client.

### `Firebase: Error (auth/unauthorized-domain)`

Add the current frontend hostname to Firebase Authentication authorized domains. Add only the hostname, not protocol or port.

### Caller audio uses REST fallback instead of WebSocket

Check:

- `NEXT_PUBLIC_BACKEND_WSS_URL` exists before client build
- HTTPS frontend uses `wss://`
- server `CORS_ORIGINS` includes the exact frontend origin
- reverse proxy forwards `/ws/*` to the backend server
- browser DevTools Network tab shows `/ws/sessions/.../caller-audio` and `/ws/sessions/.../agent-events`

### `EMPTY_TRANSCRIPT`

The server received audio, but Speech-to-Text produced no transcript. The backend intentionally drops this turn instead of saving an artificial caller message.

### SSH deploy action fails with `Permission denied (publickey)`

The GitHub Actions private key does not match a public key registered for `VM_USER` on the VM. Confirm local SSH works first:

```bash
ssh -i path/to/deploy-key -o IdentitiesOnly=yes VM_USER@VM_HOST
```

## Useful Links

- API docs: `http://localhost:4000/docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`
- WebSocket contract: `docs/websocket.md`
- ML contract: `docs/ml-contract.md`
