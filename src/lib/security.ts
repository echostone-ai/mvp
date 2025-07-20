import crypto from 'crypto';

/**
 * Generates a secure random token for invitations
 * @returns A secure random token string
 */
export async function generateSecureToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(32, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer.toString('hex'));
      }
    });
  });
}

/**
 * Hashes a password using bcrypt
 * @param password The password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  // In a real implementation, you would use bcrypt or similar
  // For now, we'll use a simple hash for demonstration
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verifies a password against a hash
 * @param password The password to verify
 * @param hash The hash to verify against
 * @returns Whether the password matches the hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // In a real implementation, you would use bcrypt or similar
  // For now, we'll use a simple hash for demonstration
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  return passwordHash === hash;
}