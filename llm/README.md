# LLM
## Before build
- Make .env file and write down like the following:
```
GEMINI_API_KEY=XXXXXXX
MODEL_NAME=XXXXXXX
```
## Build
```
docker build -t llm-analyzer .
docker run --env-file .env --rm -p 5555:5555 llm-analyzer
``` 
- For running request test, you can run the following command.
```
curl -X POST http://127.0.0.1:5555/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"지난주에도 문의했고 어제도 다시 전화했는데 아직도 처리가 안 됐잖아요."}'
``` 
