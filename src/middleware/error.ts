import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../util/exception';
import { API } from '../util/api';
import env from '../util/environment';

export function routeNotFound(req: Request, res: Response, next: NextFunction): void {
    API.error(res, 'Not Found');
}

export function errorMiddleware(err: HttpException, req: Request, res: Response, next: NextFunction): void {
    const message = env.NODE_ENV === 'development' ? err.message : 'Something went wrong';
    API.error(res, message.toString() + ' ' + err.stack);
}
