var db = require('./db.js');

var ITEMS_PER_LOG_PAGE = 20;

var RESULT_OK                = 'ok';
var RESULT_BAD_PARAM         = 'bad param';
var RESULT_SYSTEM_ERROR      = 'system error';
var RESULT_ROOM_NOT_EXISTS   = 'room not exists';
var RESULT_LOG_NOT_AVAILABLE = 'log not available';

exports.set = function (app) {
    app.get('/', index);
    app.get('/log', log);
    app.get('/log/:page', log);
    app.get('/api/log/:page', apiLog);
};

var index = function (req, res) {
    'use strict';

    res.render('index', {
        title: 'おえかきちゃっと'
    });
};

var log = function (req, res) {
    'use strict';

    res.render('log', {
        title: 'おえかきちゃっと ろぐ'
    });
};

var apiLog = function (req, res) {
    'use strict';

    var page = req.params.page;

    if (page == null || !page.match(/^[1-9][0-9]*$/)) {
        res.status(400).json({ result: RESULT_BAD_PARAM });
        return;
    }

    var query = db.Log.count();
    query.exec(function (err, count) {
        if (err) {
            res.status(500).json({ result: RESULT_SYSTEM_ERROR });
            return;
        }

        if (count === 0) {
            res.status(200).json({
                result: RESULT_OK,
                files:  [],
            });
            return;
        }

        var query = db.Log
                .find()
                .select({ fileName: 1, _id: 0 })
                .limit(ITEMS_PER_LOG_PAGE)
                .skip((page - 1) * ITEMS_PER_LOG_PAGE)
                .sort({ fileName: 'desc' });
        query.exec(function (err, logDocs) {
            if (err) {
                res.status(500).json({ result: RESULT_SYSTEM_ERROR });
                return;
            }

            res.status(200).json({
                result:       RESULT_OK,
                files:        logDocs,
                items:        count,
                itemsPerPage: ITEMS_PER_LOG_PAGE,
            });
        });
    });
};
