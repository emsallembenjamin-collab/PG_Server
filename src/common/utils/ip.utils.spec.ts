import { isIpWhitelisted, normalizeIp, normalizeIpList } from './ip.utils';

describe('ip utils', () => {
  it('normalizes ipv4-mapped ipv6 values', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it('normalizes bracketed ipv6 values with ports', () => {
    expect(normalizeIp('[2001:db8::10]:443')).toBe('2001:db8::10');
  });

  it('filters invalid values and removes duplicates from whitelist entries', () => {
    expect(
      normalizeIpList([
        '203.0.113.10',
        '::ffff:203.0.113.10',
        'invalid-ip',
        '[2001:db8::10]:443',
      ]),
    ).toEqual(['203.0.113.10', '2001:db8::10']);
  });

  it('matches normalized request ips against the whitelist', () => {
    expect(
      isIpWhitelisted('::ffff:198.51.100.25', ['198.51.100.25', '203.0.113.10']),
    ).toBe(true);
    expect(isIpWhitelisted('198.51.100.99', ['198.51.100.25'])).toBe(false);
  });
});
