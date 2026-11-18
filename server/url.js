import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
]) blocked.addSubnet(network, prefix, 'ipv4');
blocked.addSubnet('2001::', 23, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

async function resolveAddresses(hostname) {
  let timer;
  try {
    return await Promise.race([
      lookup(hostname, { all: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timed out.')), 2500); }),
    ]);
  } catch {
    // Some local DNS resolvers fail for otherwise public hosts. Validate fallback
    // addresses exactly as OS answers, and still pin the eventual connection.
    const response = await fetch('https://dns.google/resolve?name=' + encodeURIComponent(hostname) + '&type=A', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('The website address could not be resolved.');
    const result = await response.json();
    const addresses = (result.Answer || []).filter(answer => answer.type === 1 && isIP(answer.data) === 4)
      .map(answer => ({ address: answer.data, family: 4 }));
    if (result.Status !== 0 || !addresses.length) throw new Error('The website address could not be resolved.');
    return addresses;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolvePublicUrl(input) {
  const url = new URL(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
    || (url.port && !['80', '443'].includes(url.port)) || !hostname.includes('.') && !isIP(hostname)
    || hostname === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(hostname)) {
    throw Object.assign(new Error('Only public HTTP/HTTPS URLs are allowed.'), { status: 400 });
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveAddresses(hostname);
  if (!addresses.length || addresses.some(record => !isPublicAddress(record.address))) {
    throw Object.assign(new Error('Internal or reserved network addresses are not allowed.'), { status: 400 });
  }
  return { url, address: addresses[0] };
}

// Resolve and validate each redirect, then pin the connection to that public IP.
// The deadline and byte limit cover the response body as well as the headers.
export async function fetchPublicText(input, { timeout = 8000, maxBytes = 5 * 1024 * 1024 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  let current = input;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const { url, address } = await resolvePublicUrl(current);
    signal.throwIfAborted();
    const result = await new Promise((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;
      const request = transport.get(url, {
        signal,
        family: address.family,
        autoSelectFamily: false,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: { 'User-Agent': 'Anchor-Knowledge-Bot/1.0', Accept: 'text/html,text/plain' },
      }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume();
          if (!response.headers.location) return reject(new Error('Missing redirect URL.'));
          return resolve({ redirect: new URL(response.headers.location, url).href });
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          return reject(new Error('The page could not be retrieved.'));
        }
        if (!/^(text\/html|text\/plain|application\/xhtml\+xml)\b/i.test(response.headers['content-type'] || '')
          || Number(response.headers['content-length']) > maxBytes) {
          response.destroy();
          return reject(new Error('The page type or size is not supported.'));
        }
        const chunks = [];
        let bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy();
            reject(new Error('The page is too large.'));
          } else chunks.push(chunk);
        });
        response.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
        response.on('error', reject);
      });
      request.on('error', reject);
    });
    if (result.redirect) current = result.redirect;
    else return result.text;
  }
  throw new Error('The page redirected too many times.');
}
