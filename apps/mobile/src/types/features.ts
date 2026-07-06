export interface CopiFeatureFlags {
  copi_basic_reports?: boolean;
  copi_custom_reports?: boolean;
  copi_enabled?: boolean;
  copi_freeform_questions?: boolean;
  copi_pro_agent?: boolean;
  copi_vision?: boolean;
  copi_voice?: boolean;
}

export const DEFAULT_COPI_FEATURE_FLAGS: Required<CopiFeatureFlags> = {
  copi_basic_reports: true,
  copi_custom_reports: false,
  copi_enabled: true,
  copi_freeform_questions: true,
  copi_pro_agent: false,
  copi_vision: false,
  copi_voice: false,
};
