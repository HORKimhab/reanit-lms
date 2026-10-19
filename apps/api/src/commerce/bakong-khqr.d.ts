// The official `bakong-khqr` library ships no types; this covers the part the Bakong gateway uses.
declare module "bakong-khqr" {
  /** Optional KHQR fields; a dynamic KHQR (with an amount) needs `expirationTimestamp`. */
  interface KHQROptions {
    /** ISO 4217 numeric code: `khqrData.currency.usd` or `.khr`. */
    currency?: number;
    /** Major units: dollars with up to two decimals, whole riel. */
    amount?: number;
    /** Unix time in milliseconds after which banking apps refuse the code. */
    expirationTimestamp?: number;
  }

  /** The payee of a KHQR code: a Bakong account and the name and city banking apps show. */
  type IndividualInfo = { readonly bakongAccountID: string };

  /** The library's result shape: `status.code` 0 with `data`, or 1 with an error message. */
  interface KHQRResponse<T> {
    status: { code: number; errorCode: number | null; message: string | null };
    data: T | null;
  }

  /** Builds and reads KHQR codes. */
  interface BakongKHQR {
    generateIndividual(info: IndividualInfo): KHQRResponse<{ qr: string; md5: string }>;
  }

  /** The library's CommonJS export. */
  interface BakongKHQRLibrary {
    BakongKHQR: {
      new (): BakongKHQR;
      /** Reads the fields of a code, e.g. `bakongAccountID`, `transactionAmount`. */
      decode(qr: string): KHQRResponse<Record<string, string | null>>;
    };
    IndividualInfo: new (bakongAccountID: string, merchantName: string, merchantCity: string, optional?: KHQROptions) => IndividualInfo;
    khqrData: { currency: { usd: number; khr: number } };
  }

  const library: BakongKHQRLibrary;
  export default library;
}
