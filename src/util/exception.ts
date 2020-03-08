import { env } from './environment';

export class HttpException extends Error {
    public message: string;

    constructor(message: string) {
        super(message);
        this.message = message;
    }
}

export class InternalServerException extends HttpException {
    constructor(error?: string) {
        error = (env.NODE_ENV === 'development') ? error : 'Something went wrong';
        super(error);
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
