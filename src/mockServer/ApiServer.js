/*
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

/*
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global dk, $, _ */

'use strict';

var AbstractServer = require('./AbstractServer.js');

/*
 * ApiServer is a server is meant to be run in an interactive session within a browser. For example, you may want to
 * run your UI using the mock data in the server, but want to rely on fetching of other server resources from a real
 * server.
 * In general, what the ApiServer does is defer to the ServerCore to handle api calls, but when the ServerCore doesn't
 * know what to do with that call, this will then direct the query to the original $.ajax handler which will then
 * contact the real server.
 * This also will deliver results from the server core asynchronously.
 *
 * To use ApiServer, simply do the following:
 *    var server = new ApiServer(schemas);
 *    server.start();
 *
 * It is best if this is done before anything else has started interacting with the network.
 */

/*
 * If the MockServer can't figure out what to do with this call, hand it off to the real server.
 */
function handleUnknownUrl(server, method, url, settings) {
    var self = this;
    self._previousAjax(url, settings);
}

/*
 * When a callback is ready to be dealt with, run it in a setTimeout() call so it will happen
 * asynchronously from the caller's standpoint.
 */
function handleResult(server, result) {
    setTimeout(function() {
        server._deliverResult(result);
        server._processNotifications();
        $.event.trigger('ajaxComplete');
    }, 0);
}

function ApiServer(schemas) {
    var self = this;
    if (!(self instanceof ApiServer)) {
        dx.fail('Must call ApiServer() with new.');
    }

    var server = new AbstractServer(schemas);
    server._handleUnknownUrl = _.partial(handleUnknownUrl, server);
    server._handleResult = _.partial(handleResult, server);

    function performThenCheckNotifications(origFunction) {
        origFunction.apply(server, _.rest(arguments));
        server._processNotifications();
    }

    server.createObjects = _.wrap(server.createObjects, performThenCheckNotifications);
    server.updateObjects = _.wrap(server.updateObjects, performThenCheckNotifications);
    server.deleteObjects = _.wrap(server.deleteObjects, performThenCheckNotifications);

    return server;
}

module.exports = ApiServer;
