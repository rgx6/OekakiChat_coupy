var express = require('express');
var http    = require('http');
var path    = require('path');
var fs      = require('fs');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.configure('development', function () {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
    app.use(express.errorHandler());
});

app.get('/', function (req, res) {
    res.render('index', {
        title: 'おえかきちゃっと'
    });
});

app.get('/log/page:id.html', function (req, res) {
    res.render('log/page' + req.params.id, {
        title: 'おえかきちゃっと ろぐ'
    });
});

var server = http.createServer(app);
server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

var io = require('socket.io').listen(server, { 'log lever': 2 });


// Server

var points = [];

var clientsuu = 0;
var clientlist = [];

var paint = io.of('/paint').on('connection', function (socket) {
    ////接続時

    //接続数記録
    clientsuu++;
    var date = yyyymmddhhmiss();
    var path = __dirname + '/public/connection';
    var fd = fs.openSync(path, 'a');
    fs.appendFileSync(path, date + ' ' + clientsuu + '\n');
    fs.closeSync(fd);

    //全データ送信
    if (points.length > 0) {
        socket.json.emit('paint points', points);
    }

    socket.on('paint points', function (data) {
        ////受信
        for(var i in data) points.push(data[i]);
        socket.broadcast.emit('paint points',data);

        //clearsave時
        if(data[data.length - 1].s == 'clear' || data[data.length - 1].s == 'save') {
            //画像保存
            var b64data = data[data.length - 1].url.split(",")[1];
            var buf = new Buffer(b64data, 'base64');
            var path = __dirname + '/public/img/log/' + data[data.length - 1].time + '.png';
            var fd = fs.openSync(path, 'a');
            fs.appendFileSync(path, buf);
            fs.closeSync(fd);

            //サムネ付きログ生成
            path = __dirname + '/public/img/log/';
            var filelist = fs.readdirSync(path);
            filelist.sort().reverse();

            path = __dirname + '/views/log/';
            var delfilelist = fs.readdirSync(path);
            for (i in delfilelist) {
                fd = fs.openSync(path + delfilelist[i], 'a');
                fs.unlinkSync(path + delfilelist[i]);
                fs.closeSync(fd);
            }

            path = __dirname + '/views/log/page';
            for (i = 0; i < filelist.length; i++) {
                var i10 = Math.floor(i / 10) + 1;
                if(i % 10 == 0) { // 10回毎のヘッダ
                    fd = fs.openSync(path + i10 + '.jade', 'a');
                    fs.appendFileSync(path + i10 +'.jade', 'h1 ImageLog\n' + 'ul(style=\"list-style:none;\")\n');
                    fs.closeSync(fd);
                }
                // ファイルに対する処理
                fd = fs.openSync(path + i10 + '.jade', 'a');
                fs.appendFileSync(path + i10 + '.jade', '  li\n    a(href = \"' + '/img/log/' + filelist[i] + '\") ' + filelist[i] + '\n');
                fs.appendFileSync(path + i10 + '.jade', '  li\n    img(src = \"' + '/img/log/' + filelist[i] + '\",id=\"thumb\") ' + filelist[i] + '\n');
                fs.closeSync(fd);

                if (i % 10 == 9 || i == filelist.length - 1) { // 10回毎または最後のフッタ
                    fd = fs.openSync(path + i10 + '.jade', 'a');
                    fs.appendFileSync(path + i10 + '.jade', 'ul(id="mokuji")\n');
                    fs.closeSync(fd);
                    for (var j = 1; j < Math.ceil(filelist.length / 10) + 1; j++) {
                        fd = fs.openSync(path + i10 + '.jade', 'a');
                        if (j == i10) {
                            fs.appendFileSync(path + i10 + '.jade', '  li\n    ' + j + '\n');
                        } else {
                            fs.appendFileSync(path + i10 + '.jade', '  li\n    a(href = \"page' + j + '.html\") '+j+'\n');
                        }
                        fs.closeSync(fd);
                    }
                }
            }

            if (data[data.length - 1].s == 'clear') points = [];
        }
    });

    socket.on('disconnect', function () {
        //他のユーザーに送信
        socket.broadcast.emit('chara disconnect', { id: clientlist[socket.id] });

        //接続数ログ更新
        clientsuu = clientsuu - 1;
        var date = yyyymmddhhmiss();
        var fd = __dirname + '/public/connection';
        fs.openSync(fd, 'a');
        fs.appendFileSync(fd, date + ' ' + clientsuu + '\n');

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
