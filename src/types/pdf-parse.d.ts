// pdf-parse ships no type declarations, and there is no @types/pdf-parse for
// the deep `lib/pdf-parse` path we import.
//
// We import that deep path rather than the package root on purpose: the root
// index.js runs debug code that reads a test PDF off disk and throws when it is
// absent. Previously this was a bare `require()` with an eslint-disable, which
// also meant the result was implicitly `any`. Declaring the module here keeps
// the workaround and gives the call site a real type.
declare module "pdf-parse/lib/pdf-parse" {
  interface PdfParseResult {
    /** Full extracted text of the document. */
    text: string
    /** Number of pages parsed. */
    numpages: number
    /** Number of pages the PDF reports it has. */
    numrender: number
    /** PDF `info` dictionary (title, author, producer, …). */
    info: Record<string, unknown>
    /** PDF XMP metadata, or null when the document carries none. */
    metadata: Record<string, unknown> | null
    /** pdf.js version used for the parse. */
    version: string
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>

  export default pdfParse
}
