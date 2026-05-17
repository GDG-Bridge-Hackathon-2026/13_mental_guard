// zod에 .openapi() 메서드를 주입. 이 파일을 OpenAPI 관련 import보다 먼저 임포트해야 함.
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);