var requestify = require('requestify');
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

module.exports = function () {

    // delay-er
    this.delayer = function (callback) {
        var waitTill = new Date().getTime() + 1000;
        while (waitTill > new Date()) {
        }
        callback(null);
    };

    // gets data from SurveyMonkey API
    this.smGet = function (url, params, callback) {

        // start with a delay to stay with API call limits
        delayer(function (err) {

            if (!params) { params = []; }
            var authorization = 'bearer Icx4bQVqEwfhzTVqMIPZpZijzrPV1g-8.qXu3LyOL3Ly5vpP1Nd18D.zsHNSNkTxsfFGQ5KFwW9.coGViJEK1apg8DdGCA9fEew2GRG5.pCqc3krUklVUxZ9OloD8veWEoCMeBHSZNfcqJp7qQTzTVIq4-5ZHr4hVY3Y8FxKCNdqoivcOEPN.cfwS3PqKD6ZoQkrWHAGZOVXtjEcLCLP2xGMD0SFI2XNUdCAaVmFnx4=';
            params.api_key = 'myf6ujkbug9vhcyvs23s4wdv';

            requestify.get(url, {
                headers: {'Authorization': authorization, 'Content-Type': 'application/json'},
                params: params,
                dataType: 'json'
            })
                .then(function (response) {
                    r = response;
                    body = r.body;
                    body = JSON.parse(body);
                    console.log('            ~~~~ SM API response ~~~~ ' + url);
                    callback(null, body);
                })
                .catch(function (err) {
                    console.error('ERROR IN smGet WITH URL: ' + url);
                    console.error('             AND PARAMS: ' + JSON.stringify(params));
                    console.error(err);
                    callback(err);
                });
        }); // end delayer
    };

    // generic response writer
    this.writeResponse = function (res, status, message) {

        // check status
        if (!status || isNaN(parseInt(status))) {
            status = 500;
        }
        else {
            status = parseInt(status);
        }

        // check message
        if (!message || typeof message == 'undefined') {
            message = {'Message': 'undefined'};
        }
        if (typeof message == 'number') {
            message = {'Message': message};
        }
        if (typeof message != 'string') {
            message = JSON.stringify(message);
        }
        res.writeHead(status, {"Content-Type": "application/json"});
        res.end(message);
    };

    // returns a responsesEnvelope for one survey
    this.getResponsesEnvelope = function (survey, callback) {
        var url = 'https://api.surveymonkey.net/v3/surveys/' + survey.id + '/responses';
        var params = {'per_page': 1}; // don't need the responses, just the envelope
        smGet(url, params, function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                var responsesEnvelope = data;

                // modify the object returned from SM to suit our needs
                responsesEnvelope.data = []; // clear the response links, we will be adding in full responses later
                responsesEnvelope.links = []; // clear the page links, don't need them
                responsesEnvelope.survey_id = survey.id;

                callback(null, responsesEnvelope);
            }
        });
    };

    // returns surveys[] with response envelope added
    this.addResponsesEnvelopes = function (surveys, callback) {

        var addResponsesEnvelopesLoop = function (i) {
            getResponsesEnvelope(surveys[i], function (err, responsesEnvelope) {
                if (err) {
                    callback(err);
                }
                else {
                    // place responsesEnvelope on the current survey object
                    surveys[i].responsesEnvelope = responsesEnvelope;

                    // done getting individual envelope, so now increment and do next
                    i++;
                    if (i < surveys.length) {
                        addResponsesEnvelopesLoop(i);
                    }

                    // or when done, bail out with the callback
                    else {
                        callback(null, surveys);
                    }
                }
            });
        };
        addResponsesEnvelopesLoop(0);
    };

    // returns a survey bulk reponse in one page
    this.loopPagesInSurveyResponses = function (surveys, callback) {

        var i = 0;
        var loopSurveys = function (i) {

            console.log('Starting survey loop: ' + surveys[i].id + ' i= ' + i);

            var per_page = 100;
            surveyResponsesEnvelope = surveys[i].responsesEnvelope;

            // figure out how many pages there are with per_page @ 100
            var pages = surveyResponsesEnvelope.total / per_page;
            pages = Math.ceil(pages);

            var loopPages = function (page) {
                var url = 'https://api.surveymonkey.net/v3/surveys/' + surveyResponsesEnvelope.survey_id + '/responses/bulk';
                var params = {'page': page};
                params.per_page = per_page;

                console.log('        Current page: ' + page + ' of ' + pages + ' total ' + surveyResponsesEnvelope.total);
                var waitTill = new Date().getTime() + 300;
                while (waitTill > new Date()) {
                }

                var authorization = 'bearer Icx4bQVqEwfhzTVqMIPZpZijzrPV1g-8.qXu3LyOL3Ly5vpP1Nd18D.zsHNSNkTxsfFGQ5KFwW9.coGViJEK1apg8DdGCA9fEew2GRG5.pCqc3krUklVUxZ9OloD8veWEoCMeBHSZNfcqJp7qQTzTVIq4-5ZHr4hVY3Y8FxKCNdqoivcOEPN.cfwS3PqKD6ZoQkrWHAGZOVXtjEcLCLP2xGMD0SFI2XNUdCAaVmFnx4=';
                params.api_key = 'myf6ujkbug9vhcyvs23s4wdv';

                requestify.get(url, {
                    headers: {'Authorization': authorization, 'Content-Type': 'application/json'},
                    params: params,
                    dataType: 'json'
                })
                    .then(function (response) {

                        r = response;
                        body = r.body;
                        body = JSON.parse(body);
                        for (var responseNumber in body.data) {
                            surveyResponsesEnvelope.data.push(body.data[responseNumber]);
                        }

                        // now decide to either loop the next page or the next survey
                        page++;
                        if (page <= pages) {
                            loopPages(page);
                        }
                        else {
                            surveys[i].responsesEnvelope = surveyResponsesEnvelope;
                            //console.log('        Final total length: ' + JSON.stringify(surveys[i].responsesEnvelope.data.length));

                            // drop it in the db
                            insertResponsesInDb(surveys[i], function (err) {
                                if (err) {
                                    console.error(err);
                                }
                                else {
                                    console.log('*******************************************');
                                }
                            });

                            i++;
                            if (i < surveys.length) {
                                loopSurveys(i);
                            }
                            else {
                                callback(null, surveys);
                            }
                        }

                    })
                    .catch(function (err) {
                        console.error(err);
                        //callback(err);
                    });


                /*
                 smGet(url, params, function(err, body) {
                 if (err) {
                 callback(err)
                 }
                 else {
                 //console.log('on page '+ page +', number of responses: ' + body.data.length);
                 for (var i in body.data) {
                 surveyResponsesEnvelope.data.push(body.data[i]);
                 }
                 console.log('id: '+ surveyResponsesEnvelope.survey_id +' response length: ' + body.data[i].data.length);
                 // done, so now increment, delay for throttling and do next
                 page ++;
                 if(page <= pages) {
                 loopPages(page);
                 }
                 else {
                 console.log('Final total length: ' + JSON.stringify(surveyResponsesEnvelope.data.length));
                 callback(null, surveys);
                 }
                 }
                 });
                 */
            };
            loopPages(1);
        };
        loopSurveys(i);
    };

    this.getSurvey = function (survey, callback) {
        //console.log('STARTING getSurvey WITH: ' + survey.id);
        var url = 'https://api.surveymonkey.net/v3/surveys/' + survey.id + '/details';
        var authorization = 'bearer Icx4bQVqEwfhzTVqMIPZpZijzrPV1g-8.qXu3LyOL3Ly5vpP1Nd18D.zsHNSNkTxsfFGQ5KFwW9.coGViJEK1apg8DdGCA9fEew2GRG5.pCqc3krUklVUxZ9OloD8veWEoCMeBHSZNfcqJp7qQTzTVIq4-5ZHr4hVY3Y8FxKCNdqoivcOEPN.cfwS3PqKD6ZoQkrWHAGZOVXtjEcLCLP2xGMD0SFI2XNUdCAaVmFnx4=';
        requestify.get(url, {
            headers: {'Authorization': authorization, 'Content-Type': 'application/json'},
            params: {'api_key': 'myf6ujkbug9vhcyvs23s4wdv'},
            dataType: 'json'
        })
            .then(function (response) {
                r = response;
                body = r.body;
                body = JSON.parse(body);
                callback(null, body);
            })
            .catch(function (err) {
                console.error(err);
                callback(err);
            });
    };

    this.updateSurveyDetails = function (survey, callback) {
        var query = 'UPDATE db1.pn.surveys ' +
            'SET json=$1, page_count=$2, question_count=$3, preview=$4, date_modified=$5, analyze_url=$6, ' +
            'summary_url=$7, date_created=$8, collect_url=$9, edit_url=$10 ' +
            'WHERE id = ' + body.id + ';'
        var data = [JSON.stringify(survey), survey.page_count, survey.question_count, survey.preview, survey.date_modified, survey.analyze_url, survey.summary_url, survey.date_created, survey.collect_url, survey.edit_url];

        pool.connect(function (err, client, release) {
            // TODO - you'll want to handle the error in real code
            if (err) console.error(err);

            client.query(query, data, function (err, result) {
                release();
                console.log('**************************' + result.rows);
            });
        });
    };

    this.getSurveyResponses = function (survey, callback) {
        var url = 'https://api.surveymonkey.net/v3/surveys/' + survey.id + '/responses';
        var authorization = 'bearer Icx4bQVqEwfhzTVqMIPZpZijzrPV1g-8.qXu3LyOL3Ly5vpP1Nd18D.zsHNSNkTxsfFGQ5KFwW9.coGViJEK1apg8DdGCA9fEew2GRG5.pCqc3krUklVUxZ9OloD8veWEoCMeBHSZNfcqJp7qQTzTVIq4-5ZHr4hVY3Y8FxKCNdqoivcOEPN.cfwS3PqKD6ZoQkrWHAGZOVXtjEcLCLP2xGMD0SFI2XNUdCAaVmFnx4=';
        requestify.get(url, {
            headers: {'Authorization': authorization, 'Content-Type': 'application/json'},
            params: {'api_key': 'myf6ujkbug9vhcyvs23s4wdv'},
            dataType: 'json'
        })
            .then(function (response) {
                r = response;
                body = r.body;
                body = JSON.parse(body);
                callback(null, body);
            })
            .catch(function (err) {
                console.error(err);
                callback(err);
            });

    };

    this.updateSurveyDetailsResults = function (survey, callback) {
        var query = 'UPDATE db1.pn.surveys ' +
            'SET total_responses=$1 ' +
            'WHERE id = ' + body.id + ';';
        var data = [survey.total];

        pool.connect(function (err, client, release) {
            if (err) console.error(err);

            client.query(query, data, function (err, result) {
                release();
                console.log('************************************');
            });
        });
    };

    this.updateSurveyResponsesBulk = function (survey, callback) {
        var query = 'UPDATE db1.pn.surveys ' +
            'SET total_responses=$1 ' +
            'WHERE id = ' + body.id + ';'
        var data = [survey.total];

        pool.connect(function (err, client, release) {
            if (err) console.error(err);

            client.query(query, data, function (err, result) {
                release();
                console.log('************************************');
            });
        });
    };


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    this.getQuestionPagesFromApi = function (surveys, callback) {
        var i = 0;
        var surveyLoop = function (i) {
            var url = 'https://api.surveymonkey.net/v3/surveys/' + surveys[i].id + '/pages';
            // TODO: Support more than 100 pages
            var params = {'per_page': 100}; // only supporting up to 100 pages at this time
            smGet(url, params, function (err, data) {
                if (err) {
                    callback(err);
                }
                else {
                    var question_pages = data;
                    // add question_pages to this survey
                    surveys[i].question_pages = question_pages;

                    /////////////////////////////////////////////////////
                    // iterate
                    i++;
                    if (i < surveys.length) {
                        surveyLoop(i);
                    }
                    else { // or when done, bail out with the callback
                        callback(null, surveys);
                    }
                    /////////////////////////////////////////////////////
                }
            });
        };
        surveyLoop(i);
    };

    this.getSurveyQuestionsFromApi = function (surveys, callback) {
        var i = 0;
        var surveyLoop = function (i) {

            console.log('+++++++ ' + JSON.stringify(surveys[i]));

            pages = surveys[i].question_pages.total; // again, still only supporting 100 pages
            console.log('        current survey: ' + surveys[i].id + ' pages: ' + pages);

            var page = 0;
            var questions = [];
            questionPageLoop = function (page) {
                var page_id = surveys[i].question_pages.data[page].id;

                // get questions from question pages
                var url = 'https://api.surveymonkey.net/v3/surveys/' + surveys[i].id + '/pages/' + page_id + '/questions';
                var params = {'per_page': 100}; // only supporting up to 100 pages at this time
                smGet(url, params, function (err, data) {
                    if (err) {
                        callback(err);
                    }
                    else {
                        // add the whole question object to the page
                        surveys[i].question_pages.data[page].questions_envelope = data;
    
                        ////////////////////////////////////
                        // iterate
                        page++;
                        if (page < pages) {
                            questionPageLoop(page);
                        }
                        else {
                            // done looping pages
                            i++;
                            if (i < surveys.length) {
                                surveyLoop(i);
                            }
                            else {
                                callback(null, surveys);
                            }
                        }
                        ////////////////////////////////////

                    } // end if sm results
                }); // end get questions from question pages
            };
            questionPageLoop(page);
        };
        surveyLoop(i);
    };

    this.getSurveyAnswersFromApi = function (surveys, callback) {
        var i = 0;
        var surveyLoop = function (i) {

            var question_pages = surveys[i].question_pages.data;
            loopPages(surveys[i], question_pages, function (err, survey) {
                if (err) {
                    callback(err);
                }
                else {
                    // I don't think I need to do anything with the survey returned
                    i++;
                    if (i < surveys.length) {
                        surveyLoop(i);
                    }
                    else {
                        callback(null, surveys);
                    }
                }
            });
        };
        surveyLoop(i);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////// Support Functions ///////////////////////////////////////////////////////////////////////////////////////

    this.loopPages = function (survey, question_pages, callback) {

        if (!question_pages) {
            console.log('** IN loopPages - question_pages is **' + (typeof question_pages));
            callback(new Error('question_pages null or undefined'))
        }

        var page = 0;
        questionPageLoop = function (page) {
            var current_page = question_pages[page];
            var questions_envelope = current_page.questions_envelope;

            // There may be pages with no questions, in which case we need to skip the page
            if (questions_envelope.total == 0) {
                /// iterator //////////////////
                page++;
                if (page < question_pages.length) {
                    questionPageLoop(page);
                }
                else { // done looping pages
                    callback(null, survey);
                }
                ///////////////////////////////
            }
            else {
                // we have a page with questions
                loopQuestions(survey, current_page, function (err, survey) {
                    if (err) {
                        callback(err);
                    }
                    else {
                        /// iterator //////////////////
                        page++;
                        if (page < question_pages) {
                            questionPageLoop(page);
                        }
                        else { // done looping pages
                            callback(null, survey);
                        }
                        ///////////////////////////////
                    }
                });
            }
        };
        questionPageLoop(page);
    };

    this.loopQuestions = function (survey, current_page, callback) {
        if (!current_page) {
            console.log('** IN loopQuestions - current_page is **' + (typeof current_page));
            callback(new Error('current_page null or undefined'))
        }

        console.log('TOTAL: ' + current_page.questions_envelope.total);

        if (current_page.questions_envelope.total == 0) {
            console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
        }
        var all_answers = [];

        console.log('CURRENT PAGE: ' + JSON.stringify(current_page));

        //Loop questions on this page to get 'answers' for them
        var questions = current_page.questions_envelope.data;
        var question_number = 0;
        var loopQuestionsGetAnswers = function (question_number) {
            var current_question = questions[question_number];

            console.log('current_question: ' + JSON.stringify(current_question));
            if (!current_question) {
                console.log('*/*/ !current_question in loop: ' + question_number);
                console.log('*/*/ !current_question in loop: ' + JSON.stringify(question_number));
                console.log('*/*/ !current_question in loop: ' + (typeof question_number));
                ////////////////////////////////////
                // iterate
                question_number++;
                if (question_number < questions.length) {
                    loopQuestionsGetAnswers(question_number);
                }
                else {
                    callback(null, survey);
                }
                ////////////////////////////////////
            }

            // get answers from api
            var url = 'https://api.surveymonkey.net/v3/surveys/' + survey.id + '/pages/' + current_page.id + '/questions/' + current_question.id;
            console.log('URL: ' + url);
            //var params = {'per_page': 100}; // only supporting up to 100 pages at this time
            smGet(url, [], function (err, data) {
                if (err) {
                    console.error('ERROR GETTING ANSWERS');
                    console.error('FROM URL: ' + url);
                    callback(err);
                }
                else {
                    // put answers with question
                    current_question.answers = data;
                    console.log('====== ANSWER RETURNED ====== ' + JSON.stringify(data));

                    ////////////////////////////////////
                    // iterate
                    question_number++;
                    if (question_number < questions.length) {
                        loopQuestionsGetAnswers(question_number);
                    }
                    else {
                        callback(null, survey);
                    }
                    ////////////////////////////////////

                } // end if sm results
            }); // end get answers for question
        };
        loopQuestionsGetAnswers(question_number);
    };

    ////////// End Support Functions ///////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

};
