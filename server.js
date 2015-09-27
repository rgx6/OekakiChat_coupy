var express = require('express');
var http    = require('http');
var path    = require('path');
var fs      = require('fs');
var routes  = require('./routes.js');
var db      = require('./db.js');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// NODE_ENV=production node server.js  default:development
if (process.env.NODE_ENV === 'production') {
    app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));
}

// 404 not found
app.use(function (req, res) {
    res.send(404);
});

routes.set(app);

var server = http.createServer(app);
server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

// 'log lever' : 0 error  1 warn  2 info  3 debug / log: false
var io = require('socket.io').listen(server, { 'log level': 2 });

process.on('uncaughtException', function (err) {
    console.log('uncaughtException => ' + err);
});


// Server

var points = [];

var clientsuu = 0;
var clientlist = [];

var paint = io.of('/paint').on('connection', function (socket) {
    'use strict';

    clientsuu += 1;

    //全データ送信
    if (points.length > 0) {
        socket.json.emit('paint points', points);
    }

    socket.on('paint points', function (data) {
        'use strict';

        for (var i in data) {
            points.push(data[i]);
        }

        socket.broadcast.emit('paint points', data);

        //clearsave時
        if(data[data.length - 1].s == 'clear' || data[data.length - 1].s == 'save') {
            //画像保存
            var b64data = data[data.length - 1].url.split(',')[1];
            var buf = new Buffer(b64data, 'base64');
            var fileName = data[data.length - 1].time + '';
            var path = __dirname + '/public/images/log/' + fileName + '.png';
            fs.writeFile(path, buf, function (err) {
                if (err) {
                    console.log(err);
                    return;
                }

                var log = new db.Log();
                log.fileName = fileName;
                log.save(function (err, doc) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                });
            });

            if (data[data.length - 1].s == 'clear') points = [];
        }
    });

    socket.on('disconnect', function () {
        'use strict';

        clientsuu -= 1;

        //他のユーザーに送信
        socket.broadcast.emit('chara disconnect', { id: clientlist[socket.id] });

        //クライアントリストから削除
        delete clientlist[socket.id];
    });
});

var toDoubleDigits = function (num) {
    num += "";
    if (num.length === 1) {
        num = "0" + num;
    }
    return num;
};

var yyyymmddhhmiss = function () {
    var date = new Date();
    date.setTime(date.getTime() + 9 * 60 * 60 * 1000);
    var yyyy = date.getFullYear();
    var mm = toDoubleDigits(date.getMonth() + 1);
    var dd = toDoubleDigits(date.getDate());
    var hh = toDoubleDigits(date.getHours());
    var mi = toDoubleDigits(date.getMinutes());
    var ss = toDoubleDigits(date.getSeconds());
    return yyyy + '-' + mm + '-' + dd + ' ' + hh + '.' + mi + '.' + ss;
};
