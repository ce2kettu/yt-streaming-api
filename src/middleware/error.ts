import { NextFunction, Request, Response } from 'express';
import { API, env, HttpException } from '../util';

export function routeNotFound(req: Request, res: Response, next: NextFunction): void {
    API.error(res, 'Not Found');
}

export function errorMiddleware(err: HttpException, req: Request, res: Response, next: NextFunction): void {
    if (env.NODE_ENV === 'development') {
        res.json({ success: false, message: err.message, stack: err.stack });
    } else {
        res.json({ success: false, message: 'Something went wrong' });
    }
}
