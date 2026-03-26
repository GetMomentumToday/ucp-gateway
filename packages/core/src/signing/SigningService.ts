import type { CryptoKey } from 'jose';
import type { JsonWebKey } from '../types/commerce.js';
import {
  generateSigningKeyPair,
  importPrivateKey,
  buildKeyId,
  type SigningKeyPair,
} from './key-manager.js';
import { signDetachedJws, verifyDetachedJws, extractKidFromSignature } from './detached-jws.js';
import { importPublicKeyFromJwk } from './key-manager.js';

export interface SigningServiceConfig {
  readonly privateKeyJwk?: string | undefined;
  readonly keyPrefix?: string | undefined;
}

export class SigningService {
  private keyPair: SigningKeyPair | null = null;
  private readonly config: SigningServiceConfig;

  constructor(config: SigningServiceConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.keyPair) return;

    if (this.config.privateKeyJwk) {
      const privateKey = await importPrivateKey(this.config.privateKeyJwk);
      const parsed = JSON.parse(this.config.privateKeyJwk) as Record<string, unknown>;
      const publicJwk: JsonWebKey = {
        kty: parsed['kty'] as string,
        kid: parsed['kid'] as string,
        crv: parsed['crv'] as string,
        x: parsed['x'] as string,
        y: parsed['y'] as string,
        use: 'sig',
        alg: 'ES256',
      };
      this.keyPair = { privateKey, publicJwk };
    } else {
      const kid = buildKeyId(this.config.keyPrefix ?? 'ucp_gw');
      this.keyPair = await generateSigningKeyPair(kid);
    }
  }

  getPublicKeys(): readonly JsonWebKey[] {
    if (!this.keyPair) {
      throw new Error('SigningService not initialized — call initialize() first');
    }
    return [this.keyPair.publicJwk];
  }

  async sign(body: Uint8Array): Promise<string> {
    if (!this.keyPair) {
      throw new Error('SigningService not initialized — call initialize() first');
    }
    return signDetachedJws(body, this.keyPair.privateKey, this.keyPair.publicJwk.kid);
  }

  async verify(
    signature: string,
    body: Uint8Array,
    signingKeys: readonly JsonWebKey[],
  ): Promise<{ valid: true; kid: string } | { valid: false; error: string }> {
    const kid = extractKidFromSignature(signature);
    if (!kid) {
      return { valid: false, error: 'Cannot extract kid from signature' };
    }

    const matchingKey = signingKeys.find((k) => k.kid === kid);
    if (!matchingKey) {
      return { valid: false, error: `No signing key found for kid: ${kid}` };
    }

    const publicKey: CryptoKey = await importPublicKeyFromJwk(matchingKey);
    return verifyDetachedJws(signature, body, publicKey);
  }
}
