import { SERVICE_UNAVAILABLE } from 'http-status-codes';
import { NextFunction, Request, Response } from 'express';
import { API } from '../util';

export function timeout(req: Request, res: Response, next: NextFunction) {
    let timeoutSocket = null;

    // 3 seconds
    req.connection.setTimeout(3000);

    res.on('timeout', (socket) => {
        timeoutSocket = socket;

        if (!res.headersSent) {
            API.error(res, 'Service unavailable', SERVICE_UNAVAILABLE);
        }
    });

    res.on('finish', () => {
        // tslint:disable-next-line: no-unused-expression
        timeoutSocket && timeoutSocket.destroy();
    });

    next();
}
