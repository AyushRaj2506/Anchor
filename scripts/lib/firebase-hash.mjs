// Firebase Admin exports base64url; Supabase's Firebase-SCRYPT parser expects
// padded standard base64 in every component.
const base64 = value => Buffer.from(value, 'base64url').toString('base64');
export function firebasePasswordHash(user, config) {
  if (config?.algorithm !== 'SCRYPT' || !user.passwordHash || !user.passwordSalt || !config.signerKey || !config.saltSeparator) {
    throw new Error('A complete Firebase SCRYPT export is required.');
  }
  return `$fbscrypt$v=1,n=${config.memoryCost},r=${config.rounds},p=1,ss=${base64(config.saltSeparator)},sk=${base64(config.signerKey)}$${base64(user.passwordSalt)}$${base64(user.passwordHash)}`;
}
