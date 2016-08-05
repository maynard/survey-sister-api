var pg = require('pg');

var Pool = require('pg').Pool;
var pool = new Pool({
    user: 'api',
    password: 'api',
    host: 'db1.c8oihyejjcde.us-east-1.rds.amazonaws.com',
    database: 'db1',
    max: 50, // max number of clients in pool
    idleTimeoutMillis: 1000, // close & remove clients which have been idle > 1 second
});

// generic query tool
module.exports = function () {
    this.query = function(sql, params, callback) {
        pool.connect(function(err, client, release) {
            if (err) {
                callback(err);
            }
            else {
                client.query(sql, params, function (err, result) {
                    if (err) {
                        callback(err);
                    }
                    else {
                        release();
                        console.log('            ** query executed ** ' + sql);
                        callback(null, result.rows);
                    }
                });
            }
        });
    };

    this.insertResponsesInDb = function(survey, callback) {
        i=0;
        loopResponses = function() {
            var thisResponse = survey.responsesEnvelope.data[i];
            i++;
            if (i < survey.responsesEnvelope.data.length) {
                loopResponses(i);
            }
            else {
                callback(null);
            }
        };
        loopResponses(i);

        /*
        var sql = 'UPDATE db1.pn.surveys ' +
            'SET responses_envelope = $1 ' +
            'WHERE id = ' + survey.id + ';';
        var data = [survey.responsesEnvelope];

        query(sql, data, function(err, result){
            if (err) { callback(err); }
            else { callback(null, result); }
        });
        */
    };
    
    this.getSurveysNeedingResponsesEnvelope = function(callback) {
    
        var sql = 'SELECT id FROM db1.pn.surveys WHERE responses_envelope is null LIMIT 5;';
        var params = []; // or data passed in
    
        query(sql, params, function(err, result){
            if (err) { callback(err); }
            else { callback(null, result); }
        });
    };
    
    this.getSurveysNeedingQuestionPages = function(callback) {

        var sql = 'SELECT id FROM db1.pn.surveys WHERE question_pages is null LIMIT 1;';
        var params = []; // or data passed in
        
        query(sql, params, function(err, result){
            if (err) { callback(err); }
            else { callback(null, result); }
        });
    };



};
