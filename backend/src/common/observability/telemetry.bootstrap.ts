import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace';

let sdk: NodeSDK | undefined;

function isEnabled(value: string | undefined): boolean {
  if (value === undefined || value.toLowerCase() === 'false') {
    return false;
  }
  if (value.toLowerCase() === 'true') {
    return true;
  }
  throw new Error('OTEL_ENABLED must be either true or false.');
}

function exporterEndpoint(value: string | undefined): string {
  const endpoint = value ?? 'http://localhost:4318';
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OTEL_EXPORTER_OTLP_ENDPOINT must use HTTP or HTTPS.');
  }
  const basePath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = basePath.endsWith('/v1/traces')
    ? basePath
    : `${basePath}/v1/traces`;
  return parsed.toString();
}

export function initializeTelemetry(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (!isEnabled(environment.OTEL_ENABLED) || sdk) {
    return;
  }

  const exporter = environment.OTEL_TRACES_EXPORTER ?? 'otlp';
  if (exporter !== 'otlp' && exporter !== 'none') {
    throw new Error('OTEL_TRACES_EXPORTER must be either otlp or none.');
  }
  const serviceName = environment.OTEL_SERVICE_NAME?.trim() || 'backend-api';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    textMapPropagator: new W3CTraceContextPropagator(),
    instrumentations: [
      new HttpInstrumentation({
        requestHook: (span, request) => {
          if ('url' in request && typeof request.url === 'string') {
            span.setAttribute('url.path', '[REDACTED]');
            span.setAttribute('url.full', 'http://redacted/');
            span.setAttribute('url.query', '');
            span.setAttribute('http.target', '/');
          }
        },
      }),
    ],
    ...(exporter === 'otlp'
      ? {
          traceExporter: new OTLPTraceExporter({
            url: exporterEndpoint(environment.OTEL_EXPORTER_OTLP_ENDPOINT),
          }),
        }
      : { spanProcessors: [new NoopSpanProcessor()] }),
  });
  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  const activeSdk = sdk;
  sdk = undefined;
  await activeSdk?.shutdown();
}
