/*
 * Copyright (C) 2014-2015 University of Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var express = require('express');
var router = express.Router();
var date_format = require('dateformat');

function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

/** @brief Get a list of all experiments
 *
 * @param req the request object
 * @param res the response object
 * @param next error handler
 *
 * @return a JSON array of all experiments
 */
router.get('/', function(req, res, next) {
    var client = req.app.get('elastic'),
      query = '{ "query": { "match_all": {} } }',
      json = {},
      size = 1000;

    client.search({
        index: 'mf',
        type: 'experiments',
        searchType: 'count'
    }, function(error, response) {
        if (response.hits !== undefined) {
            size = response.hits.total;
        }

        client.search({
            index: 'mf',
            type: 'experiments',
            body: query,
            size: size,
            sort: '@timestamp:desc'
        }, function(error, response) {
            if (response.hits !== undefined) {
                var results = response.hits.hits;
                json = get_details(results);
            } else {
                json.error = 'No data found in the database.';
            }
            res.json(json);
        });
    });
});

/** @brief Check if a variable is defined or not
 *
 * @return true or false
 */
function is_defined(variable) {
    return (typeof variable !== 'undefined');
}

/** @brief Check if an object is empty or not
 *
 * @return true or false
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/** @brief Get the details of all experiments
 *
 * @return an array of experiments with updated id, timestamp, job_id data
 */
function get_details(results) {
    var keys = Object.keys(results),
      item = {},
      response = [];
    keys.forEach(function(key) {
        item = results[key]._source;
        if (isEmpty(item)) {
            return;
        }

        /* update time format */
        item.id = results[key]._id;
        item.timestamp = date_format(item['@timestamp'], "yyyy/mm/dd' 'HH:MM", true);
        delete item['@timestamp'];

        /* set missing job id */
        if (!is_defined(item.job_id)) {
            item.job_id = 'n/a';
        }
        response.push(item);
    });

    return response;
}

module.exports = router;
