const express = require('express');
const { setApiRoutes } = require('./api');

function setRoutes(app) {
    const router = express.Router();
    
    setApiRoutes(router);
    
    app.use('/api', router);
}

module.exports = { setRoutes };