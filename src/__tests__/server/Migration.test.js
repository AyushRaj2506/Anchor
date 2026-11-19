// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { firebasePasswordHash } from '../../../scripts/lib/firebase-hash.mjs';

describe('Legacy password migration encoding', () => {
  it('converts Firebase base64url to the padded standard base64 Supabase expects', () => {
    const config = { algorithm: 'SCRYPT', memoryCost: 14, rounds: 8, saltSeparator: 'Bw', signerKey: '-_8' };
    const hash = firebasePasswordHash({ passwordHash: '__8', passwordSalt: '-w' }, config);
    expect(hash).toBe('$fbscrypt$v=1,n=14,r=8,p=1,ss=Bw==,sk=+/8=$+w==$//8=');
  });
  it('refuses an incomplete export instead of creating an account with a broken password', () => {
    expect(() => firebasePasswordHash({}, { algorithm: 'SCRYPT' })).toThrow('complete');
  });
});
