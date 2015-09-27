(function () {
    'use strict';

    $(document).ready(function () {
        'use strict';

        var page = getPageFromUrl();
        if (!page) location = '/log';

        getList(page);

        window.onpopstate = function (event) {
            'use strict';
            // console.log('onpopstate');

            page = getPageFromUrl();
            getList(page);
        };

        function getPageFromUrl () {
            'use strict';
            // console.log('getPageFromUrl');

            if (location.pathname.match(/^\/log\/?$/)) {
                return 1;
            } else if (location.pathname.match(/^\/log\/(\d+)\/?$/)) {
                return RegExp.$1;
            } else {
                return null;
            }
        }

        function getList (page) {
            'use strict';
            // console.log('getList');

            $.ajax({
                type: 'GET',
                url: '/api/log/' + page,
                cache: false,
                dataType: 'json',
                success: function (data, dataType)  {
                    showList(data.files);
                    showPager(data.items, data.itemsPerPage);
                },
                error: function (req, status, error) {
                    console.error(req.responseJSON);
                    $('#list').empty();
                    $('#list').append('エラー');
                }
            });
        }

        function showList (files) {
            'use strict';
            // console.log('showList');

            $('#list').empty();

            files.forEach(function (file) {
                $('#list').append(
                    '<a class="thumbnail pull-left" href="/images/log/' + file.fileName + '.png">'
                        + '<img src="/images/log/' + file.fileName + '.png"'
                        + 'alt="ファイルがないよ(´・ω・｀)" />'
                        + '<div class="caption text-center">'
                        + file.fileName
                        + '</div>');
            });
        }

        function showPager (items, itemsPerPage) {
            'use strict';
            // console.log('showPager');

            $('#pagination').pagination({
                items: items,
                itemsOnPage: itemsPerPage,
                currentPage: page,
                prevText: '前',
                nextText: '次',
                hrefTextPrefix: '',
                onPageClick: function (pageNumber, event) {
                    page = pageNumber;
                    getList(page);
                    history.pushState(null, null, '/log/' + page);
                    return false;
                },
            });
        }
    });
})();
