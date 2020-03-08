import { Router } from 'express';
import { YoutubeRoutes } from '../modules/youtube';
import { API } from '../util';

const routes = Router();

routes.use('/music', new YoutubeRoutes().router);

routes.get('/status', (req, res, next) => {
    API.response(res);
});

export default routes;
