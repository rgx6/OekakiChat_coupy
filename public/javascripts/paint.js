$(document).ready(function () {

    var DEFAULT_BRUSH_SIZE = 4;

    //未送信バッファ
    var bufpts = [];
    //スタンプ画像リスト
    var imgarr = [];

    var //描画スタイル
    brushsize,
    mycolor,
    brushstyle,

    //今の座標
    positioning,
    //過去の座標
    positioned,

    drawing,
    selecting,
    buffering,
    clearing,
    mouseout,
    shiftdown,
    focused,

    browser,

    socket,

    //描画キャンバス
    maincvs,
    mainctx,
    //スタンプ用キャンバス
    stampcvs,
    stampctx,
    //カーソル用キャンバス
    mousecvs,
    mousectx,

    colorselector,
    brushselector;

    var brushSizePen    = DEFAULT_BRUSH_SIZE;
    var brushSizeEraser = DEFAULT_BRUSH_SIZE;
    var brushSizeStamp  = DEFAULT_BRUSH_SIZE;

    // 溜まったバッファを送信
    var emit = function () {
        if (!buffering) return;

        socket.json.emit('paint points', bufpts);
        bufpts = [];
        buffering = false;
    };

    // 画面に描画
    var paint = function (points) {
        clearing = false;

        var paintLine = function () {
            mainctx.lineWidth = points.w;
            mainctx.strokeStyle = points.c;
            var kisuu_hosei = points.w % 2 === 0 ? 0 : 0.5; // 奇数なら座標0.5マイナス

            for (var i = 1; i < points.x.length; i++) {
                mainctx.beginPath();
                mainctx.moveTo(points.x[i - 1] - kisuu_hosei, points.y[i - 1] - kisuu_hosei);
                mainctx.lineTo(points.x[i] - kisuu_hosei, points.y[i] - kisuu_hosei);
                mainctx.stroke();
            }
        };

        var paintArc = function () {
            mainctx.fillStyle = points.c;
            mainctx.beginPath();
            mainctx.arc(points.x, points.y, points.w / 2, 0, Math.PI * 2, true);
            mainctx.fill();
        };

        var paintStamp = function () {
            var stampSize = {
                x: Math.round(imgarr[points.img].width * (0.5 + points.w / 10)),
                y: Math.round(imgarr[points.img].height * (0.5 + points.w / 10)),
            };

            var stampPosition = {
                x: Math.round(points.x - stampSize.x / 2),
                y: Math.round(points.y - stampSize.y / 2),
            };

            stampctx.clearRect(0, 0, stampcvs.width, stampcvs.height);
            stampctx.drawImage(imgarr[points.img], stampPosition.x, stampPosition.y, stampSize.x, stampSize.y);
            var stampData = stampctx.getImageData(stampPosition.x, stampPosition.y, stampSize.x, stampSize.y);
            var maincvsData = mainctx.getImageData(stampPosition.x, stampPosition.y, stampSize.x, stampSize.y);

            mainctx.fillStyle = points.c;
            var stamp_r = parseInt(mainctx.fillStyle.substring(1, 3), 16);
            var stamp_g = parseInt(mainctx.fillStyle.substring(3, 5), 16);
            var stamp_b = parseInt(mainctx.fillStyle.substring(5, 7), 16);

            var alpha;
            for (var i in stampData.data) {
                if (i % 4 == 3 && stampData.data[i] > 0) {
                    alpha = stampData.data[i] / 255;
                    maincvsData.data[i - 3] = stamp_r * alpha + maincvsData.data[i - 3] * (1 - alpha);
                    maincvsData.data[i - 2] = stamp_g * alpha + maincvsData.data[i - 2] * (1 - alpha);
                    maincvsData.data[i - 1] = stamp_b * alpha + maincvsData.data[i - 1] * (1 - alpha);
                }
            }

            mainctx.putImageData(maincvsData, stampPosition.x, stampPosition.y);
        };

        var paintClear = function () {
            clearing = true;
            mainctx.fillStyle = "white";
            mainctx.fillRect(0, 0, maincvs.width, maincvs.height);
        };

        switch (points.s) {
            case 'line':
                paintLine();
                break;

            case 'arc':
                paintArc();
                break;

            case 'stamp':
                paintStamp();
                break;

            case 'clear':
                paintClear();
                break;
        }
    };

    //バッファする
    var buffer = function (points) {
        if (points.s == 'line') {
            var linepoints = {
                s: points.s,
                x: [points.xp, points.x],
                y: [points.yp, points.y],
                w: points.w,
                c: points.c,
            };

            if (bufpts.length > 0) {
                if (bufpts.slice(-1)[0].s == points.s &&
                    bufpts.slice(-1)[0].c == points.c &&
                    bufpts.slice(-1)[0].w == points.w &&
                    bufpts.slice(-1)[0].s == 'line') {
                    bufpts[bufpts.length - 1].x.push(points.x);
                    bufpts[bufpts.length - 1].y.push(points.y);
                } else {
                    bufpts.push(linepoints);
                }
            } else {
                bufpts.push(linepoints);
            }
        } else {
            bufpts.push(points);
        }

        // クリアセーブは即送信・他は0.5秒ごとに送信
        if (points.s == 'clear' || points.s == 'save') {
            buffering = true;
            emit();
        } else if (!buffering) {
            buffering = true;
            setTimeout(function () { emit(); }, 500);
        }
    };

    // 各種お絵描き
    var drawArc = function (event, color) {
        positioning = position(event);
        var points = {
            s: 'arc',
            x: positioning.x,
            y: positioning.y,
            w: brushsize,
            c: color,
        };
        buffer(points);
        paint(points);
    };

    var drawLine = function (event, color) {
        var positions = position(event);
        var points = {
            s:  'line',
            x:  positions.x,
            y:  positions.y,
            xp: positioning.x,
            yp: positioning.y,
            w:  brushsize,
            c:  color,
        };
        buffer(points);
        paint({
            s: points.s,
            x: [points.xp ,points.x],
            y: [points.yp ,points.y],
            w: points.w,
            c: points.c,
        });
        positioning = positions;
    };

    var drawStamp = function (event, img, color) {
        positioning = position(event);
        var points = {
            s:   'stamp',
            x:   positioning.x,
            y:   positioning.y,
            w:   brushsize,
            c:   color,
            img: img,
        };
        buffer(points);
        paint(points);
    };

    // カーソル表示
    var displayCursor = function (event) {
        var positions = position(event);
        mousectx.clearRect(0, 0, mousecvs.width, mousecvs.height);

        switch (brushstyle) {
            case 'pen':
                mousectx.fillStyle = getSelectedColor();
                mousectx.beginPath();
                mousectx.arc(positions.x, positions.y, brushsize / 2, 0, Math.PI * 2, true);
                mousectx.fill();

                if (shiftdown) displayShiftLine();
                break;

            case 'eraser':
                mousectx.lineWidth = 1;
                mousectx.strokeStyle = 'black';
                mousectx.fillStyle = 'white';
                mousectx.beginPath();
                mousectx.arc(positions.x, positions.y, brushsize / 2, 0, Math.PI * 2, true);
                mousectx.stroke();
                mousectx.fill();

                if (shiftdown) displayShiftLine();
                break;

            case 'gnh':
                var stampSize = {
                    x : Math.round(imgarr['gnh'].width * (0.5 + brushsize / 10)),
                    y : Math.round(imgarr['gnh'].height * (0.5 + brushsize / 10)),
                };
                var stampPosition = {
                    x : Math.round(positions.x - stampSize.x / 2),
                    y : Math.round(positions.y - stampSize.y / 2),
                };
                stampctx.clearRect(0, 0, stampcvs.width, stampcvs.height);
                stampctx.drawImage(imgarr['gnh'], stampPosition.x, stampPosition.y, stampSize.x, stampSize.y);

                var stampData = stampctx.getImageData(stampPosition.x, stampPosition.y, stampSize.x, stampSize.y);

                mousectx.fillStyle = getSelectedColor();
                var stamp_r = parseInt(mousectx.fillStyle.substring(1, 3), 16);
                var stamp_g = parseInt(mousectx.fillStyle.substring(3, 5), 16);
                var stamp_b = parseInt(mousectx.fillStyle.substring(5, 7), 16);
                for (var i in stampData.data) {
                    if (i % 4 == 3 && stampData.data[i] > 0) {
                        stampData.data[i - 3] = stamp_r;
                        stampData.data[i - 2] = stamp_g;
                        stampData.data[i - 1] = stamp_b;
                    }
                }
                mousectx.putImageData(stampData, stampPosition.x, stampPosition.y);
                break;

            case 'spuit':
                break;
        }
    };

    // shiftした時のプレビュー表示
    var displayShiftLine = function () {
        if (!positioning) return;

        if (brushstyle != 'pen' && brushstyle != 'eraser') return;

        mousectx.lineWidth = brushsize;
        if (brushstyle == 'pen') {
            mousectx.strokeStyle = getSelectedColor();
        } else if (brushstyle == 'eraser') {
            mousectx.strokeStyle = 'white';
        }
        mousectx.beginPath();
        mousectx.moveTo(positioned.x, positioned.y);
        mousectx.lineTo(positioning.x, positioning.y);
        mousectx.stroke();
    };

    // イベント

    var onMouseDown = function (event) {
        event.stopPropagation();
        drawing = true;

        switch (brushstyle) {
            case 'pen':
                if (shiftdown) {
                    drawLine(event, getSelectedColor());
                } else {
                    drawArc(event, getSelectedColor());
                }
                break;

            case 'eraser':
                if (shiftdown) {
                    drawLine(event,'white');
                } else {
                    drawArc(event,'white');
                }
                break;

            case 'gnh':
                drawStamp(event, brushstyle, getSelectedColor());
                break;

            case 'spuit':
                positioning = position(event);
                var imgdata = mainctx.getImageData(positioning.x, positioning.y, 1, 1);

                var hex ='';

                for (var i = 0; i < 3; i++) {
                    hex += toDoubleDigits16(imgdata.data[i].toString(16));
                }

                var cs = $('#cs');
                cs.ColorPickerSetColor('#' + hex);
                cs.css('backgroundColor', '#' + hex);
                cs.val('#' + hex);

                if ($('.colorpicker_hsb_b').children('input')[0].value < 80) {
                    cs.css('color','#ffffff');
                } else {
                    cs.css('color','#000000');
                }
                break;
        }
    };

    var onMouseMove = function (event) {
        event.stopPropagation();
        event.preventDefault();

        if (browser.indexOf("IE") != -1 && mouseout) {
            return;
        }

        positioned = position(event);
        displayCursor(event);

        if (drawing) {
            if (brushstyle === 'pen') {
                drawLine(event, cs.style.backgroundColor);
            } else if (brushstyle == 'eraser') {
                drawLine(event, 'white');
            }
        }
    };

    var onMouseUp = function (event) {
        event.stopPropagation();
        drawing = false;
    };

    var onMouseOut = function (event) {
        event.stopPropagation();
        mouseout = true;
        if (drawing == true) {
            drawing = false;
            positioning = position(event);
            if (brushstyle == 'pen') {
                drawLine(event, getSelectedColor());
            } else if (brushstyle == 'eraser') {
                drawLine(event,'white');
            }
        }
        mousectx.clearRect(0, 0, mousecvs.width, mousecvs.height);
    };

    var onMouseOver = function (event) {
        event.stopPropagation();
        mouseout = false;
        mousectx.clearRect(0, 0, mousecvs.width, mousecvs.height);
    };

    var onKeyDown = function (event) {
        if (event.shiftKey) {
            if (!shiftdown && positioning) displayShiftLine();
        }

        shiftdown = event.shiftKey;

        return false;
    };

    var onKeyUp = function (event) {
        if (shiftdown && positioning) {
            mousectx.clearRect(0, 0, mousecvs.width, mousecvs.height);
        }

        shiftdown = event.shiftKey;

        return false;
    };

    var onSaveClick = function () {
        var date = new Date();
        var points = {
            s:    'save',
            url:  maincvs.toDataURL(),
            time: yyyymmddhhmiss(),
        };

        buffer(points);

        var url = maincvs.toDataURL();

        window.open(url, 'data url');
    };

    var onClearClick = function () {
        if (clearing) return;

        var date = new Date();
        var points = {
            s:    'clear',
            id:   maincvs.id,
            url:  maincvs.toDataURL(),
            time: yyyymmddhhmiss(),
        };

        buffer(points);
        paint(points);
    };

    var onLogClick = function () {
        window.open('/log/page1.html', null);
    };

    // 初期化
    var init = function () {
        brushsize = DEFAULT_BRUSH_SIZE;
        mycolor = '#000000';
        brushstyle = 'pen';
        positioning = null;
        positioned = null;
        drawing = false;
        selecting = false;
        buffering = false;
        clearing = false;
        mouseout = false;
        shiftdown = false;
        focused = false;

        browser = navigator.userAgent;

        $.blockUI({
            message: '<h4>読み込み中</h4>'
        });

        socket = new io.connect('/paint');
        socket.on('paint points', function (data) {
            for (var i in data) paint(data[i]);
            $.unblockUI();
        });

        imgarr = { 'gnh': new Image() };
        imgarr['gnh'].src = '/images/hibiki.png';

        stampcvs = $('#p0')[0];
        stampctx = stampcvs.getContext('2d');

        maincvs = $('#p1')[0];
        mainctx = maincvs.getContext('2d');
        mainctx.fillStyle = 'white';
        mainctx.fillRect(0, 0, maincvs.width, maincvs.height);
        mainctx.lineWidth = 4;
        mainctx.lineCap = 'round';
        mainctx.fillStyle = 'black';
        mainctx.strokeStyle = 'black';

        mousecvs = $('#p2')[0];
        mousectx = mousecvs.getContext('2d');
        mousectx.lineCap ='round';

        colorselector = $('#cs')[0];
        $('#cs').ColorPicker({
            color: '#000000',
            onChange: function (hsb, hex, rgb) {
                $('#cs').css('backgroundColor', '#' + hex);
                $('#cs').val('#' + hex);
                if (hsb.b < 80) {
                    $('#cs').css('color','#ffffff');
                } else {
                    $('#cs').css('color','#000000');
                }
            }
        });
        brushselector = $('#brushgroup')[0];
        brushselector.onchange = function (event) {
            brushstyle = $("#brushgroup input[name='bg']:checked").val();

            switch (brushstyle) {
                case 'pen':
                    brushsize = brushSizePen;
                    $('#brushsize').slider('enable');
                    break;
                case 'eraser':
                    brushsize = brushSizeEraser;
                    $('#brushsize').slider('enable');
                    break;
                case 'spuit':
                    $('#brushsize').slider('disable');
                    break;
                case 'gnh':
                    brushsize = brushSizeStamp;
                    $('#brushsize').slider('enable');
                    break;
            }

            $('#brushsize').slider('value', brushsize);
        };
        // ブラウザによってはreload時にradio buttonが初期化されないので対策
        $('#brush1').prop('checked', true);

        $('#brushsize').slider({
            value: 4,
            min:   1,
            max:   20,
            slide: function (event, ui) {
                brushsize = ui.value;

                switch (brushstyle) {
                    case 'pen':
                        brushSizePen = brushsize;
                        break;
                    case 'eraser':
                        brushSizeEraser = brushsize;
                        break;
                    case 'gnh':
                        brushSizeStamp = brushsize;
                        break;
                }
            }
        });

        // イベント登録
        mousecvs.onmousedown = onMouseDown;
        mousecvs.onmousemove = onMouseMove;
        mousecvs.onmouseout = onMouseOut;
        mousecvs.onmouseover = onMouseOver;
        mousecvs.onmouseup = onMouseUp;
        document.onkeydown = onKeyDown;
        document.onkeyup = onKeyUp;
        $('#save').click(onSaveClick);
        $('#log').click(onLogClick);
        $('#clear').click(onClearClick);
    };

    init();

    function getSelectedColor () {
        return colorselector.style.backgroundColor;
    };

    // 汎用的な関数

    // マウスの座標なおす
    function position (event) {
        var rect = event.target.getBoundingClientRect();
        return {
            x: Math.floor(event.clientX - rect.left),
            y: Math.floor(event.clientY - rect.top),
        };
    }

    // 2ケタにする
    function toDoubleDigits (num) {
        num += "";
        if (num.length === 1) {
            num = "0" + num;
        }
        return num;
    }

    // 16進2ケタ
    function toDoubleDigits16 (string) {
        if (string.length == 1) {
            string = "0" + string;
        }
        return string;
    }

    // 日付取得整形
    function yyyymmddhhmiss () {
        var date = new Date();
        var yyyy = date.getFullYear();
        var mm = toDoubleDigits(date.getMonth() + 1);
        var dd = toDoubleDigits(date.getDate());
        var hh = toDoubleDigits(date.getHours());
        var mi = toDoubleDigits(date.getMinutes());
        var ss = toDoubleDigits(date.getSeconds());
        return yyyy + '-' + mm + '-' + dd + ' ' + hh + '.' + mi + '.' + ss;
    }
}, false);
