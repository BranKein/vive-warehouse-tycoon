/**
 * A rough name for this device, from the user agent: "iPhone · Safari", "Mac · Chrome".
 * Only shown to the player beside a cloud save, so a wrong guess does no harm.
 */
export function deviceName(userAgent: string, maxTouchPoints = 0): string {
  const ua = userAgent;
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Macintosh|Mac OS X/.test(ua)
            ? 'Mac'
            : /Windows/.test(ua)
              ? 'Windows'
              : /Linux/.test(ua)
                ? 'Linux'
                : '';
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser\//.test(ua)
      ? 'Samsung Internet'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /OPR\//.test(ua)
          ? 'Opera'
          : /Chrome\/|CriOS\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : '';
  return [system, browser].filter(Boolean).join(' · ') || 'Browser';
}

export function currentDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  return deviceName(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
