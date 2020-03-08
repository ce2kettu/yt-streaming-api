import { Router } from 'express';
import { YoutubeController } from './controller';
import { apiKey, validateVideoId, validatePlaylistId } from '../../middleware';

export class YoutubeRoutes {
    public router: Router;
    private controller: YoutubeController;

    constructor() {
        this.router = Router();
        this.controller = new YoutubeController();
        this.routes();
    }

    // tslint:disable: max-line-length
    public routes() {
        // Commented methods are disabled for this implementation, so
        // a client cannot request the server to download songs
        this.router.get('/stream/:videoId', this.controller.streamClient.bind(this.controller));
        //this.router.get('/search', apiKey, this.controller.search.bind(this.controller));
        this.router.get('/stream/chunked/:videoId', validateVideoId, this.controller.streamChunked.bind(this.controller));
        this.router.get('/predownload/:videoId', validateVideoId, apiKey, this.controller.predownload.bind(this.controller));
        this.router.get('/verify/:videoId', validateVideoId, apiKey, this.controller.checkVideoExists.bind(this.controller));
        this.router.get('/song/:videoId', validateVideoId, apiKey, this.controller.getSongInfo.bind(this.controller));
        this.router.get('/playlist/:playlistId', validatePlaylistId, apiKey, this.controller.getPlaylistInfo.bind(this.controller));
    }
}
