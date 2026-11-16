export interface RequestContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly userId?: number;
}
