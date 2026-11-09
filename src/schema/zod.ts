import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// One zod instance, extended with .openapi() so the schemas that validate
// requests also generate the OpenAPI document (src/config/openapi.ts).
extendZodWithOpenApi(z)

export { z }
