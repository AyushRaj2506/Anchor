// @vitest-environment node
import { EventEmitter } from 'node:events';
import https from 'node:https';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isPublicAddress, resolvePublicUrl, fetchPublicText } from '../../../server/url.js';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async hostname => hostname === 'private.example.com'
  ? [{ address: '10.0.0.1', family: 4 }]
  : [{ address: '93.184.216.34', family: 4 }]) }));
afterEach(() => vi.restoreAllMocks());

describe('URL network boundaries', () => {
  it.each(['127.0.0.1', '127.1.2.3', '0.0.0.0', '10.2.3.4', '100.64.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1'])('blocks nonpublic addresses: %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])('allows global public addresses: %s', address => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it.each(['http://localhost/', 'http://127.1/', 'http://2130706433/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'file:///etc/passwd', 'https://user:password@example.com/', 'https://private.example.com/'])('rejects unsafe URLs: %s', async url => {
    await expect(resolvePublicUrl(url)).rejects.toThrow();
  });
  it('checks redirects before connecting to an internal network', async () => {
    const get = vi.spyOn(https, 'get').mockImplementation((_url, options, callback) => {
      options.lookup('example.com', {}, (error, address) => { expect(error).toBeNull(); expect(address).toBe('93.184.216.34'); });
      const response = new EventEmitter();
      response.statusCode = 302;
      response.headers = { location: 'http://169.254.169.254/latest/meta-data/' };
      response.resume = vi.fn();
      queueMicrotask(() => callback(response));
      return new EventEmitter();
    });
    await expect(fetchPublicText('https://example.com')).rejects.toThrow(/Internal/);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('enforces the streamed response limit without trusting Content-Length', async () => {
    vi.spyOn(https, 'get').mockImplementation((_url, _options, callback) => {
      const response = new EventEmitter();
      response.statusCode = 200;
      response.headers = { 'content-type': 'text/html' };
      response.destroy = vi.fn();
      queueMicrotask(() => { callback(response); response.emit('data', Buffer.alloc(101)); });
      return new EventEmitter();
    });
    await expect(fetchPublicText('https://example.com', { maxBytes: 100 })).rejects.toThrow('too large');
  });
});
