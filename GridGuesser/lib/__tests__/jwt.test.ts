/**
 * Unit Tests for lib/jwt.ts
 *
 * WHAT THIS FILE TESTS:
 * jwt.ts provides three functions for JSON Web Token (JWT) authentication:
 *   1. generateToken  — creates a signed token from user data
 *   2. verifyToken    — validates a token and extracts the user data
 *   3. extractTokenFromHeader — pulls the token string out of an HTTP
 *      "Authorization: Bearer <token>" header
 *
 * WHY WE DON'T NEED TO MOCK MUCH:
 * Unlike database or network code, jwt.ts only depends on the `jsonwebtoken`
 * npm package which is a pure computation library (no I/O, no network calls).
 * So most tests use the REAL jwt functions — we get genuine encode/decode cycles
 * which gives us higher confidence than mocking everything.
 *
 * We only mock `jsonwebtoken` for one specific edge case: simulating an expired
 * token, because we can't wait 7 real days for a token to expire in a test.
 *
 * TESTING CONCEPTS USED:
 *   - describe()  — groups related tests together, like a chapter in a book
 *   - it()        — defines a single test case (one specific behavior to verify)
 *   - expect()    — makes an assertion: "I expect this value to equal/match X"
 *   - vi.fn()     — creates a fake function whose calls you can inspect
 *   - vi.mock()   — replaces an entire module import with a fake version
 *   - AAA pattern — Arrange (set up data), Act (call the function), Assert (check result)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, extractTokenFromHeader, JWTPayload } from '../jwt';

// ---------------------------------------------------------------------------
// A reusable sample payload we can use across many tests.
// This mimics what a real user's token data looks like.
// ---------------------------------------------------------------------------
const samplePayload: JWTPayload = {
  userId: 'user-123',
  email: 'test@example.com',
  username: 'testplayer',
};

// ============================================================================
// generateToken — turns user data into a signed JWT string
// ============================================================================
describe('generateToken', () => {
  it('should return a non-empty string', () => {
    // Arrange — we already have samplePayload defined above

    // Act — call the function we're testing
    const token = generateToken(samplePayload);

    // Assert — check that we got something back
    // A token should never be empty or undefined
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  it('should return a valid JWT with 3 dot-separated segments', () => {
    // JWTs always have the format: header.payload.signature
    // Each part is base64url-encoded, separated by dots.
    const token = generateToken(samplePayload);

    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    // Each segment should be a non-empty base64 string
    parts.forEach((part) => {
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it('should embed the correct payload fields when decoded', () => {
    const token = generateToken(samplePayload);

    // jwt.decode reads the payload WITHOUT verifying the signature.
    // We use it here just to peek inside the token and check the data.
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.userId).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.username).toBe('testplayer');
  });

  it('should produce different tokens for different payloads', () => {
    const token1 = generateToken(samplePayload);
    const token2 = generateToken({
      userId: 'user-456',
      email: 'other@example.com',
      username: 'otherplayer',
    });

    // Two different users should never get the same token
    expect(token1).not.toBe(token2);
  });

  it('should include an exp (expiry) claim in the token', () => {
    // The source code sets expiresIn: "7d", so the token must contain an
    // "exp" field — a Unix timestamp for when the token stops being valid.
    const token = generateToken(samplePayload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.exp).toBeDefined();
    // exp should be a number (Unix seconds) in the future
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.exp as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should include an iat (issued-at) claim in the token', () => {
    // "iat" = issued at — the time the token was created.
    // jsonwebtoken adds this automatically.
    const token = generateToken(samplePayload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.iat).toBeDefined();
    expect(typeof decoded.iat).toBe('number');
  });
});

// ============================================================================
// verifyToken — checks that a token is valid and not tampered with
// ============================================================================
describe('verifyToken', () => {
  it('should return the payload for a valid token', () => {
    // Arrange — create a real token
    const token = generateToken(samplePayload);

    // Act — verify it
    const result = verifyToken(token);

    // Assert — should get a non-null payload back
    expect(result).not.toBeNull();
  });

  it('should return userId, email, username matching the original', () => {
    const token = generateToken(samplePayload);
    const result = verifyToken(token);

    // The verified payload should contain exactly the data we put in
    expect(result?.userId).toBe('user-123');
    expect(result?.email).toBe('test@example.com');
    expect(result?.username).toBe('testplayer');
  });

  it('should return null for a completely garbage string', () => {
    // A random string is not a valid JWT — verifyToken should catch the
    // error internally and return null instead of crashing.
    const result = verifyToken('this-is-not-a-jwt');

    expect(result).toBeNull();
  });

  it('should return null for a token signed with a different secret', () => {
    // If someone creates a token with a different secret key, our server
    // should reject it. This is how JWT prevents forgery.
    const forgedToken = jwt.sign(samplePayload, 'wrong-secret-key');

    const result = verifyToken(forgedToken);

    expect(result).toBeNull();
  });

  it('should return null for an expired token', () => {
    // We can't wait 7 days for a token to expire, so we create a token
    // that already expired by using a negative expiresIn value.
    const expiredToken = jwt.sign(
      samplePayload,
      // Use the same secret the source code uses (the default fallback)
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '-1s' }, // expired 1 second ago
    );

    const result = verifyToken(expiredToken);

    expect(result).toBeNull();
  });

  it('should return null for a malformed token (missing segments)', () => {
    // A JWT needs exactly 3 dot-separated parts. Two parts is invalid.
    const result = verifyToken('part1.part2');

    expect(result).toBeNull();
  });

  it('should return null for an empty string', () => {
    const result = verifyToken('');

    expect(result).toBeNull();
  });

  it('should roundtrip: verifyToken(generateToken(payload)) returns original fields', () => {
    // The most important test: create a token, then verify it, and confirm
    // we get back the same user data we started with. This tests the full
    // encode → decode cycle end-to-end.
    const payload: JWTPayload = {
      userId: 'roundtrip-id',
      email: 'roundtrip@test.com',
      username: 'roundtripuser',
    };

    const token = generateToken(payload);
    const result = verifyToken(token);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('roundtrip-id');
    expect(result?.email).toBe('roundtrip@test.com');
    expect(result?.username).toBe('roundtripuser');
  });

  it('should include JWT standard fields (iat, exp) in the raw decoded token', () => {
    // verifyToken returns the payload AS a JWTPayload type, but the raw
    // decoded object from jsonwebtoken also includes iat and exp.
    // This test documents that behavior.
    const token = generateToken(samplePayload);
    const result = verifyToken(token) as Record<string, unknown> | null;

    expect(result).not.toBeNull();
    // These fields come from jsonwebtoken, not from our code
    expect(result?.iat).toBeDefined();
    expect(result?.exp).toBeDefined();
  });
});

// ============================================================================
// extractTokenFromHeader — parses the HTTP Authorization header
// ============================================================================
describe('extractTokenFromHeader', () => {
  it('should return the token from a valid "Bearer xxx" header', () => {
    // HTTP APIs send tokens as: Authorization: Bearer <token>
    // This function extracts just the <token> part.
    const result = extractTokenFromHeader('Bearer my-secret-token');

    expect(result).toBe('my-secret-token');
  });

  it('should return null when the header is undefined', () => {
    // If no Authorization header was sent at all, the value is undefined.
    const result = extractTokenFromHeader(undefined);

    expect(result).toBeNull();
  });

  it('should return null when the header is an empty string', () => {
    const result = extractTokenFromHeader('');

    expect(result).toBeNull();
  });

  it('should return null when the prefix is not "Bearer"', () => {
    // "Basic" is a different auth scheme (username:password base64-encoded).
    // Our app only accepts "Bearer" tokens.
    const result = extractTokenFromHeader('Basic some-credentials');

    expect(result).toBeNull();
  });

  it('should return null when the header has more than 2 parts', () => {
    // "Bearer token extra-stuff" has 3 space-separated parts — invalid.
    const result = extractTokenFromHeader('Bearer token extra-stuff');

    expect(result).toBeNull();
  });

  it('should return null when the header is just "Bearer" with no token', () => {
    // "Bearer" alone (1 part) has no token after it.
    const result = extractTokenFromHeader('Bearer');

    expect(result).toBeNull();
  });
});
