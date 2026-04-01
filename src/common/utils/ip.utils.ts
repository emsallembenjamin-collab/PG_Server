import * as net from 'net';

export function normalizeIp(value?: string | null): string | null {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return null;
  }

  let candidate = rawValue.replace(/^"|"$/g, '');

  const bracketedIpv6Match = candidate.match(/^\[([^[\]]+)\](?::\d+)?$/);
  if (bracketedIpv6Match) {
    candidate = bracketedIpv6Match[1];
  }

  const zoneIndex = candidate.indexOf('%');
  if (zoneIndex >= 0) {
    candidate = candidate.slice(0, zoneIndex);
  }

  const ipv4MappedMatch = candidate.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch && net.isIP(ipv4MappedMatch[1]) === 4) {
    return ipv4MappedMatch[1];
  }

  if (net.isIP(candidate)) {
    return candidate.toLowerCase();
  }

  const ipv4WithPortMatch = candidate.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  if (ipv4WithPortMatch && net.isIP(ipv4WithPortMatch[1]) === 4) {
    return ipv4WithPortMatch[1];
  }

  return null;
}

export function normalizeIpList(
  values?: Array<string | null | undefined> | null,
): string[] | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const normalizedValues = Array.from(
    new Set(
      values
        .map((value) => normalizeIp(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return normalizedValues.length > 0 ? normalizedValues : null;
}

export function isIpWhitelisted(
  requestIp?: string | null,
  whitelistedIps?: Array<string | null | undefined> | null,
): boolean {
  const normalizedRequestIp = normalizeIp(requestIp);
  const normalizedWhitelist = normalizeIpList(whitelistedIps);

  if (!normalizedRequestIp || !normalizedWhitelist || normalizedWhitelist.length === 0) {
    return false;
  }

  return normalizedWhitelist.includes(normalizedRequestIp);
}
