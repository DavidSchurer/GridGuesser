import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
// Mock sharp before importing the module under test
vi.mock('sharp', () => {
  const mockExtract = vi.fn().mockReturnThis();
  const mockJpeg = vi.fn().mockReturnThis();
  const mockToFile = vi.fn().mockResolvedValue({});
  const mockResize = vi.fn().mockReturnValue({
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-image')),
  });
  const mockMetadata = vi.fn().mockResolvedValue({
    width: 1920,
    height: 1080,
    format: 'jpeg',
  });
  const sharpInstance = {
    metadata: mockMetadata,
    resize: mockResize,
    extract: mockExtract,
    jpeg: mockJpeg,
    toFile: mockToFile,
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('resized-image')),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn, __mockInstance: sharpInstance };
});
// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-image')),
    rmSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-image')),
  rmSync: vi.fn(),
}));
// Mock http/https to avoid real network calls
vi.mock('https', () => ({
  default: {
    get: vi.fn((url, opts, callback) => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: vi.fn((event, handler) => {
          if (event === 'data') handler(Buffer.from('fake-image-data'));
          if (event === 'end') handler();
          return mockResponse;
        }),
      };
      callback(mockResponse);
      return { on: vi.fn() };
    }),
  },
}));
vi.mock('http', () => ({
  default: {
    get: vi.fn((url, opts, callback) => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: vi.fn((event, handler) => {
          if (event === 'data') handler(Buffer.from('fake-image-data'));
          if (event === 'end') handler();
          return mockResponse;
        }),
      };
      callback(mockResponse);
      return { on: vi.fn() };
    }),
  },
}));
import fs from 'fs';
import { generateTiles, cleanupTiles, getTilePath } from '../tileGenerator';
describe('tileGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks only resets call history, NOT implementations.
    // Tests that override fs mocks (like "skip generation") leave stale
    // return values for subsequent tests, so we re-establish defaults here.
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-image'));
  });
  describe('generateTiles', () => {
    it('should return success and a hash for a valid image URL', async () => {
      const result = await generateTiles('https://example.com/photo.jpg');
      expect(result.success).toBe(true);
      expect(result.imageHash).toBeTruthy();
      expect(result.imageHash).toHaveLength(32); // MD5 produces 32-char hex
      expect(result.error).toBeUndefined();
    });
    it('should produce a deterministic hash for the same URL', async () => {
      const result1 = await generateTiles('https://example.com/photo.jpg');
      const result2 = await generateTiles('https://example.com/photo.jpg');
      expect(result1.imageHash).toBe(result2.imageHash);
    });
    it('should produce different hashes for different URLs', async () => {
      const result1 = await generateTiles('https://example.com/photo1.jpg');
      const result2 = await generateTiles('https://example.com/photo2.jpg');
      expect(result1.imageHash).not.toBe(result2.imageHash);
    });
    it('should generate exactly 100 tiles (10x10 grid)', async () => {
      const sharp = (await import('sharp')).default;
      await generateTiles('https://example.com/photo.jpg');
      // sharp() is called once for metadata, then once per tile (100 times)
      // The first call is for the original image (metadata + resize)
      // Then sharp(resizedBuffer) is called 100 times for extraction
      const sharpCalls = vi.mocked(sharp).mock.calls;
      // 1 call for the original image + 100 calls for tile extraction
      expect(sharpCalls.length).toBe(101);
    });
    it('should resize the image to 1000x1000 before tiling', async () => {
      const { __mockInstance } = await import('sharp') as any;
      await generateTiles('https://example.com/photo.jpg');
      expect(__mockInstance.resize).toHaveBeenCalledWith(1000, 1000, {
        fit: 'cover',
        position: 'center',
      });
    });
    it('should extract tiles with correct 100x100 dimensions', async () => {
      const { __mockInstance } = await import('sharp') as any;
      await generateTiles('https://example.com/photo.jpg');
      const extractCalls = __mockInstance.extract.mock.calls;
      expect(extractCalls.length).toBe(100);
      // Verify the first tile (top-left corner)
      expect(extractCalls[0][0]).toEqual({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      });
      // Verify tile at row 0, col 1
      expect(extractCalls[1][0]).toEqual({
        left: 100,
        top: 0,
        width: 100,
        height: 100,
      });
      // Verify tile at row 1, col 0
      expect(extractCalls[10][0]).toEqual({
        left: 0,
        top: 100,
        width: 100,
        height: 100,
      });
      // Verify the last tile (bottom-right corner, index 99)
      expect(extractCalls[99][0]).toEqual({
        left: 900,
        top: 900,
        width: 100,
        height: 100,
      });
    });
    it('should skip generation if 100 tiles already exist', async () => {
      // Simulate tiles already existing
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(
        Array.from({ length: 100 }, (_, i) => `${i}.jpg`) as any
      );
      const result = await generateTiles('https://example.com/photo.jpg');
      expect(result.success).toBe(true);
      // sharp should NOT be called if tiles already exist
      const sharp = (await import('sharp')).default;
      expect(sharp).not.toHaveBeenCalled();
    });
    it('should handle image with missing dimensions gracefully', async () => {
      const { __mockInstance } = await import('sharp') as any;
      // Simulate sharp returning metadata with no width/height
      __mockInstance.metadata.mockResolvedValueOnce({
        format: 'jpeg',
        // width and height are undefined
      });
      const result = await generateTiles('https://example.com/bad-image.jpg');
      expect(result.success).toBe(false);
      expect(result.imageHash).toBe('');
      expect(result.error).toBe('Could not determine image dimensions');
    });
    it('should handle sharp processing errors gracefully', async () => {
      const { __mockInstance } = await import('sharp') as any;
      __mockInstance.metadata.mockRejectedValueOnce(
        new Error('Input buffer contains unsupported image format')
      );
      const result = await generateTiles('https://example.com/not-an-image.txt');
      expect(result.success).toBe(false);
      expect(result.imageHash).toBe('');
      expect(result.error).toBe('Input buffer contains unsupported image format');
    });
    it('should handle download failure (non-200 status)', async () => {
      const https = (await import('https')).default;
      vi.mocked(https.get).mockImplementationOnce((url: any, opts: any, callback: any) => {
        const mockResponse = {
          statusCode: 404,
          headers: {},
          on: vi.fn(),
        };
        callback(mockResponse);
        return { on: vi.fn() } as any;
      });
      const result = await generateTiles('https://example.com/missing.jpg');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download image');
    });
    it('should handle network errors gracefully', async () => {
      const https = (await import('https')).default;
      vi.mocked(https.get).mockImplementationOnce((url: any, opts: any, callback: any) => {
        const req = {
          on: vi.fn((event, handler) => {
            if (event === 'error') handler(new Error('ECONNREFUSED'));
            return req;
          }),
        };
        return req as any;
      });
      const result = await generateTiles('https://example.com/photo.jpg');
      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
    it('should read from local filesystem for non-HTTP URLs', async () => {
      await generateTiles('images/local-photo.jpg');
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should follow HTTP redirects (3xx with location header)', async () => {
      const https = (await import('https')).default;
      vi.mocked(https.get)
        .mockImplementationOnce((url: any, opts: any, callback: any) => {
          callback({
            statusCode: 301,
            headers: { location: 'https://example.com/redirected.jpg' },
            on: vi.fn(),
          });
          return { on: vi.fn() } as any;
        })
        .mockImplementationOnce((url: any, opts: any, callback: any) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: vi.fn((event: string, handler: Function) => {
              if (event === 'data') handler(Buffer.from('redirected-data'));
              if (event === 'end') handler();
              return mockResponse;
            }),
          };
          callback(mockResponse);
          return { on: vi.fn() } as any;
        });

      const result = await generateTiles('https://example.com/will-redirect.jpg');
      expect(result.success).toBe(true);
    });

    it('should use http client for http:// URLs', async () => {
      const http = (await import('http')).default;

      const result = await generateTiles('http://example.com/photo.jpg');

      expect(result.success).toBe(true);
      expect(http.get).toHaveBeenCalled();
    });

    it('should re-generate tiles when directory exists but has fewer than 100', async () => {
      const sharp = (await import('sharp')).default;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(
        Array.from({ length: 50 }, (_, i) => `${i}.jpg`) as any
      );

      const result = await generateTiles('https://example.com/photo.jpg');

      expect(result.success).toBe(true);
      expect(vi.mocked(sharp)).toHaveBeenCalled();
      // Should NOT call mkdirSync since directory already exists
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle a non-Error throw with "Unknown error"', async () => {
      const { __mockInstance } = await import('sharp') as any;
      __mockInstance.metadata.mockRejectedValueOnce('string-not-an-Error-object');

      const result = await generateTiles('https://example.com/photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should fail when redirect has no location header (3xx without location)', async () => {
      const https = (await import('https')).default;
      vi.mocked(https.get).mockImplementationOnce((url: any, opts: any, callback: any) => {
        callback({
          statusCode: 302,
          headers: {},
          on: vi.fn(),
        });
        return { on: vi.fn() } as any;
      });

      const result = await generateTiles('https://example.com/bad-redirect.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download image: 302');
    });

    it('should handle response stream errors', async () => {
      const https = (await import('https')).default;
      vi.mocked(https.get).mockImplementationOnce((url: any, opts: any, callback: any) => {
        const mockResponse = {
          statusCode: 200,
          headers: {},
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'error') handler(new Error('Stream corrupted'));
            return mockResponse;
          }),
        };
        callback(mockResponse);
        return { on: vi.fn() } as any;
      });

      const result = await generateTiles('https://example.com/corrupt.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stream corrupted');
    });

    it('should handle missing height with valid width', async () => {
      const { __mockInstance } = await import('sharp') as any;
      __mockInstance.metadata.mockResolvedValueOnce({
        width: 1920,
        format: 'jpeg',
      });

      const result = await generateTiles('https://example.com/no-height.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not determine image dimensions');
    });

    it('should handle zero width', async () => {
      const { __mockInstance } = await import('sharp') as any;
      __mockInstance.metadata.mockResolvedValueOnce({
        width: 0,
        height: 1080,
        format: 'jpeg',
      });

      const result = await generateTiles('https://example.com/zero-width.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not determine image dimensions');
    });
  });
  describe('getTilePath', () => {
    it('should return the tile path when the file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = getTilePath('abc123', 0);
      expect(result).toBe(
        path.join(process.cwd(), 'public', 'tiles', 'abc123', '0.jpg')
      );
    });
    it('should return null when the tile file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = getTilePath('abc123', 0);
      expect(result).toBeNull();
    });
    it('should construct the correct path for any tile index', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = getTilePath('hash456', 99);
      expect(result).toContain('hash456');
      expect(result).toContain('99.jpg');
    });
  });
  describe('cleanupTiles', () => {
    it('should remove the tile directory when it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      cleanupTiles('abc123');
      expect(fs.rmSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'public', 'tiles', 'abc123'),
        { recursive: true, force: true }
      );
    });
    it('should do nothing when the tile directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      cleanupTiles('nonexistent');
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should catch and suppress errors when rmSync throws', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.rmSync).mockImplementationOnce(() => {
        throw new Error('EPERM: operation not permitted');
      });

      expect(() => cleanupTiles('abc123')).not.toThrow();
    });
  });
});