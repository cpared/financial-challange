import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from './request-context.types.js';

@Injectable()
export class RequestContextStorage {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getContext(): RequestContext | undefined {
    return this.storage.getStore();
  }
}
