import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        response.status(status).json(payload);
        return;
      }
      response.status(status).json({ error: { code: status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR', message: status === 404 ? 'Resource not found.' : 'Request failed.', details: [] } });
      return;
    }
    // Internal errors are deliberately not returned to clients.
    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', details: [] } });
  }
}
