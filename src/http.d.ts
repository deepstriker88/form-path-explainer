/** Optional Request/Response adapter. No network listener or process is started. */
export interface FormHttpOptions {
  /** Caller must verify identity/entitlement server-side; never trust client claims. */
  authorize: (request: Request) => boolean | Promise<boolean>;
  /** Caller must enforce an atomic rate/usage quota. */
  consumeQuota: (request: Request) => boolean | Promise<boolean>;
  /** Maximum request bytes; defaults to 65,536 and cannot exceed 1 MiB. */
  maxBytes?: number;
}
export declare function createFormHttpHandler(options: FormHttpOptions): (request: Request) => Promise<Response>;
