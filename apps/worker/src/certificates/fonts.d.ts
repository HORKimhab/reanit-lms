/** A font file, bundled as its bytes (tsup's `binary` loader; the `bytes` plugin in vitest.config.ts). */
declare module "*.ttf" {
  const bytes: Uint8Array;
  export default bytes;
}
