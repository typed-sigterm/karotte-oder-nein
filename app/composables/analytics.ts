let mixpanel: Promise<typeof import('mixpanel-browser')['default']> | undefined;
export function useMixpanel() {
  return mixpanel ||= import('mixpanel-browser').then((mod) => {
    mod.default.init(import.meta.env.VITE_MIXPANEL_TOKEN, {
      track_pageview: !import.meta.env.DEV,
      api_host: 'https://mp-api.by-ts.top',
    });
    if (import.meta.env.DEV)
      mod.default.disable();
    return mod.default;
  });
}

export async function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!import.meta.client || !import.meta.env.VITE_MIXPANEL_TOKEN)
    return;

  const mod = await useMixpanel();
  mod.track(event, properties);
}
