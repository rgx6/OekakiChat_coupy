(function () {
    'use strict';

    var mongoose = require('mongoose');
    var Schema = mongoose.Schema;

    var LogSchema = new Schema({
        fileName: { type: String, require: true, index: true }
    });
    LogSchema.set('autoIndex', false);
    mongoose.model('Log', LogSchema);

    mongoose.connect('mongodb://localhost/kabayaki');

    exports.Log = mongoose.model('Log');
})();
