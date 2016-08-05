/**
 * Created by Maynard Black
 */

require('./tools.js')();
require('./database.js')();
var express = require("express");
var http = require("http");
var app = express();
var requestify = require('requestify');
var util = require('util');
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/',function(req,res){
    console.log('Welcome.');
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify('Welcome'));
});

// iterate survey table, fetch details
app.get('/surveymonkey/surveys/details', function (req, res) {
    console.log('Starting...');
    var surveys = [];
    client.connect(function (err) {
        if (err) console.log(err);
        client.query('SELECT * FROM db1.pn.surveys where date_modified is null;', [], function (err, result) {
            if (err) console.log(err);
            surveys = result.rows;

            var i = 0;
            var loopArray = function(surveys) {
                getSurvey(surveys[i],function(err, survey){
                    if (err) console.error(err);

                    console.log('RETURNED SURVEY ID: ' + survey.id);

                    updateSurveyDetails(survey, function(err, results){
                        //if (err) console.error(err);
                        //console.log(JSON.stringify(results));
                    });

                    // done, so now increment, delay for throttling and do next
                    i++;
                    var waitTill = new Date().getTime() + 1000;
                    while (waitTill > new Date()) {}
                    if(i < surveys.length) { loopArray(surveys);}
                    //if(i < 3) { loopArray(surveys);}
                });
            };
            loopArray(surveys);
        });
    });
});

// get bulk response detail
app.get('/surveymonkey/surveys/results/bulk', function (req, res, next) {
    
    // get all surveys from the database to save hits to SM API
    var surveys = [];
    getSurveysNeedingResponsesEnvelope(function(err, surveys){
        if(err) {
            console.error(err);
            writeResponse(res, err.code, err);
        }
        else {
            res.surveys = surveys;
            console.log('Number of surveys: ' + surveys.length);
            next();
        }
    });

}, function (req, res, next) {
    // loop through all surveys in collection to get response envelope info and add it to each survey
    addResponsesEnvelopes(res.surveys, function(err, surveys) {
        if (err) { 
            console.error(err);
            writeResponse(res, err.code, err);
        }
        else {
            res.surveys = surveys;
            next();
        }
    });

}, function (req, res, next) {
    // loop collection of surveys, get all survey responses
    loopPagesInSurveyResponses(res.surveys, function (err, surveys) {
        if (err) {
            console.error(err);
            writeResponse(res, err.code, err);
        }
        else {
            res.surveys = surveys;
            next();
        }
    });

}, function (req, res) {

    //console.log('FINAL: ' + JSON.stringify(res.surveys));

    console.log('Done.');
    writeResponse(res, 200, res.surveys);
});


// get survey questions & answers
app.get('/surveymonkey/surveys/questions', function (req, res, next) {

        // get surveys from db
        res.surveys = [];
        getSurveysNeedingQuestionPages(function (err, surveys) {
            if (err) {
                console.error(err);
                writeResponse(res, err.code, err);
            }
            else {
                res.surveys = surveys;
                console.log('Number of surveys: ' + surveys.length);
                next();
            }
        });

    },

    // Get survey question pages from API
    function (req, res, next) {
        getQuestionPagesFromApi(res.surveys, function (err, surveys) {
            if (err) {
                console.error(err);
                writeResponse(res, err.code, err);
            }
            else {
                res.surveys = surveys;
                next();
            }
        });
    },

    // Get survey questions from API
    function (req, res, next) {
        getSurveyQuestionsFromApi(res.surveys, function (err, surveys) {
            if (err) {
                console.error(err);
                writeResponse(res, err.code, err);
            }
            else {
                //res.surveys = surveys;
                next();
            }
        });
    },
    
    // Get survey answers from API
    function (req, res, next) {
         getSurveyAnswersFromApi(res.surveys, function (err, surveys) {
            if (err) {
                console.error(err);
                writeResponse(res, err.code, err);
            }
            else {
                res.surveys = surveys;
                next();
            }
        });
    },
    
    function (req, res) {
        console.log('Done.');
        writeResponse(res, 200, res.surveys);
    });

http.createServer(app).listen(1337);
