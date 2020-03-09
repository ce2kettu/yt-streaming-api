import { NextFunction, Request, Response } from 'express';
import { API, env, HttpException } from '../util';
import { INTERNAL_SERVER_ERROR, OK } from 'http-status-codes';

export function routeNotFound(req: Request, res: Response, next: NextFunction): void {
    API.error(res, 'Not Found', 404);
}

export function errorMiddleware(err: HttpException, req: Request, res: Response, next: NextFunction): void {
    if (!res.headersSent) {
        if (env.NODE_ENV === 'development') {
            res.status(OK).json({ success: false, message: err.message, stack: err.stack });
        } else {
            const isAllowedException = err.name = 'HttpException';
            res.status(INTERNAL_SERVER_ERROR).json({
                success: false, message: isAllowedException ? err.message : 'Something went wrong',
            });
        }
    }
}
