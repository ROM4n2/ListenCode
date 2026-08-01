declare module 'node-forge' {
  namespace cipher {
    function createCipher(algo: string, key: string): Cipher;
    interface Cipher {
      start(config?: { iv?: string }): void;
      update(buffer: any): void;
      finish(): boolean;
      output: { data: string; toHex(): string };
    }
  }

  namespace util {
    function createBuffer(data: string): any;
    function encode64(data: string): string;
    function bytesToHex(data: string): string;
    function encodeUtf8(data: string): string;
  }

  namespace md5 {
    function create(): MD5Digest;
    interface MD5Digest {
      update(data: string | any): MD5Digest;
      digest(): { toHex(): string };
    }
  }

  namespace jsbn {
    class BigInteger {
      constructor(hex: string, radix: number);
      modPow(exp: BigInteger, mod: BigInteger): BigInteger;
      toString(radix?: number): string;
    }
  }

  const md5: typeof md5;
  const cipher: typeof cipher;
  const util: typeof util;
  const jsbn: typeof jsbn;
}
