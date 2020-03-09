import { env } from './environment';

export class HttpException extends Error {
    public message: string;

    constructor(message: string) {
        super(message);
        this.message = message;
        this.name = 'HttpException';
    }
}

export class InternalServerException extends HttpException {
    constructor(message?: string) {
        console.log('[ERROR]: ' + message);
        message = (env.NODE_ENV === 'development') ? message : 'Something went wrong';
        super(message);
    }
}

export class UnauthorizedException extends HttpException {
    constructor(message: string) {
        super(message);
    }
}

export class BadRequestException extends HttpException {
    constructor(message?: string) {
        message = message || 'Bad Request';
        super(message);
    }
}
