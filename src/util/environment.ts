import { config } from 'dotenv';
import { resolve } from 'path';

export interface IProcessEnv {
    NODE_ENV: string;
    YT_API_KEY: string;
    APP_PORT: string;
    APP_HOST: string;
    APP_PROTOCOL: string;
    FFMPEG_PATH: string;
    __basedir: string;
}

declare global {
    namespace NodeJS {
        // tslint:disable-next-line: all
        interface ProcessEnv extends IProcessEnv { }
    }
}

process.env.__basedir = resolve(__dirname, '../../');

// Load configuration variables
config({ path: resolve(__dirname, `../../.env.${process.env.NODE_ENV}`) });

export default process.env;
