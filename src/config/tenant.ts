import { env } from "@/lib/env";

export type TenantConfig = {
  name: string;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  locale: string;
};

// Pulled straight from validated env. Cached — env() itself is memoized so
// every call is cheap.
export function tenantConfig(): TenantConfig {
  const e = env();
  return {
    name: e.CLIENT_NAME,
    logoUrl: e.CLIENT_LOGO_URL,
    primaryColor: e.CLIENT_PRIMARY_COLOR,
    timezone: e.CLIENT_TIMEZONE,
    locale: e.CLIENT_LOCALE,
  };
}
