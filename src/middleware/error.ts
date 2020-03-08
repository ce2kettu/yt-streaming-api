import { NextFunction, Request, Response } from 'express';
import { API, env, HttpException, InternalServerException } from '../util';

export function routeNotFound(req: Request, res: Response, next: NextFunction): void {
    API.error(res, 'Not Found');
}

export function errorMiddleware(err: HttpException, req: Request, res: Response, next: NextFunction): void {
    if (env.NODE_ENV === 'development') {
        res.json({ success: false, message: err.message, stack: err.stack });
    } else {
        const isAllowedException = err instanceof InternalServerException;
        res.json({ success: false, message: isAllowedException ? err.message : 'Something went wrong' });
    }
}
