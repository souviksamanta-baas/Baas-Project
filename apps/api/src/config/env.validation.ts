import Joi from 'joi';

const productionSecret = Joi.when('NODE_ENV', {
  is: 'production',
  then: Joi.string().trim().required(),
  otherwise: Joi.string().trim().optional().allow(''),
});

function validateCorsOrigins(value: string | undefined, helpers: Joi.CustomHelpers) {
  if (!value) {
    return value;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === '*') {
      return helpers.error('any.invalid');
    }

    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return helpers.error('any.invalid');
      }
    } catch {
      return helpers.error('any.invalid');
    }
  }

  return value;
}

export const envValidationSchema = Joi.object({
  API_PORT: Joi.number().port().optional(),
  BAAS_ENABLE_OPENAPI_DOCS: Joi.string().trim().valid('true', 'false', '1', '0', '').optional().allow(''),
  BAAS_OTP_PEPPER: Joi.string().trim().optional().allow(''),
  BAAS_CORS_ALLOWED_ORIGINS: Joi.string()
    .trim()
    .optional()
    .allow('')
    .custom(validateCorsOrigins, 'CORS origin allowlist validation'),
  BAAS_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(300),
  BAAS_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  BAAS_TASKS_JOB_SECRET: productionSecret,
  BAAS_WEBHOOK_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(120),
  BAAS_WEBHOOK_RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60_000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().optional(),
  SUPABASE_SERVICE_ROLE_KEY: productionSecret,
  SUPABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional().allow(''),
  }),
  WHATSAPP_APP_SECRET: productionSecret,
  WHATSAPP_VERIFY_TOKEN: productionSecret,
  INSTAGRAM_APP_SECRET: Joi.string().trim().optional().allow(''),
  INSTAGRAM_APP_ID: Joi.string().trim().optional().allow(''),
  INSTAGRAM_VERIFY_TOKEN: Joi.string().trim().optional().allow(''),
  INSTAGRAM_OAUTH_REDIRECT_URI: Joi.string().trim().optional().allow(''),
  META_APP_ID: Joi.string().trim().optional().allow(''),
  META_APP_SECRET: Joi.string().trim().optional().allow(''),
  BAAS_TOKEN_ENCRYPTION_KEY: Joi.string().trim().optional().allow(''),
  NEXOLIA_AUTH_WABA_ACCESS_TOKEN: Joi.string().trim().optional().allow(''),
  NEXOLIA_AUTH_WABA_PHONE_NUMBER_ID: Joi.string().trim().optional().allow(''),
  NEXOLIA_AUTH_OTP_TEMPLATE_LANGUAGE: Joi.string().trim().optional().allow(''),
  NEXOLIA_AUTH_OTP_TEMPLATE_NAME: Joi.string().trim().optional().allow(''),
  OPENAI_API_KEY: Joi.string().trim().optional().allow(''),
  OPENAI_MODEL: Joi.string().trim().optional().allow(''),
  OPENAI_VISION_MODEL: Joi.string().trim().optional().allow(''),
});
