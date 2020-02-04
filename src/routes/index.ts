import { Router } from 'express';
import { YoutubeRoutes } from '../modules/youtube/routes';
import { API } from '../util/api';

const routes = Router();

routes.use('/music', new YoutubeRoutes().router);

routes.get('/status', (req, res, next) => {
    API.response(res);
});

export default routes;
