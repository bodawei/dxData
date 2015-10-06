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

/*global $, require, module */

'use strict';

var dxLog = require('dxLog');
var _ = require('underscore');

var AbstractServer = require('./AbstractServer.js');

/*
 * Defines a MockServer which responds to $.ajax calls, and then stores results until a caller/test calls respond().
 * This allows tests to make use of asynchronous behavior without actually creating asynchronous tests.
 *
 * An example use is:
 *
 *    it('does something wonderful', function() {
 *        var mockServer = new MockServer(MY_SCHEMAS);
 *        mockServer.start();
 *
 *        var promise = dxData.getServerModelPromise('CONTAINER-1', 'Container');
 *        promise.then(function() {});
 *
 *        // Note that this has "sent" an "asynchronous" request to the MockServer
 *        assert(promise).not.toHaveBeenCalled();
 *
 *        mockServer.respond(); // Tell the server to deliver the "asynchronous" results to the client
 *
 *        expect(resultSpy).toHaveBeenCalled();
 *    });
 *
 * Note that this MockServer is a ServerCore instance, so all the functions on ServerCore to add, update etc. are here
 * as well.
 *
 * It is notable that the respond() function can take a function with the following signature:
 *     respondFilter(response, stash)
 * response is a Response object which has these interesting properties:
 *    index     The number (starting at 1) of the response during the current respond() call
 *    getData() Returns the data to be returned to the client
 *    deliver() Tells the mock server to deliver this response to the client
 *    stash()   Tells the mock server to store this response for future handling (see "stash", below)
 *    delay(ms) Tells the mock server to deliver this response after "ms" milliseconds (caller must still call respond)
 * stash is an object that contains any responses that have been previously stash()'ed during this test. You can:
 *    getSize()    Returns how many responses are in the stash
 *    deliverAll() Have all the responses in the stash returned to the client
 *
 * Note that if a respondFilter is provided, if there are no already-existing responses waiting to be delivered, and
 * there are items in the stash, the responseFilter will be called with the response object set to undefined.  This
 * allows you to have the opportunity to work with the stash despite the absence of pending responses.
 */

/*
 * Response is the "public interface" to results that is given to respond() callers that pass in a filter function.
 * This provides functions for all the things that can be done with the result. It does rely on intimate access to
 * the mock server's internals.
 */
function Response(result, resultCount, server) {
    var self = this;
    self._result = result;
    self._server = server;
    self._delivered = false;
    self._handled = undefined;
    self.index = resultCount;
}

function getData() {
    var self = this;
    return self._result.data;
}

function deliver() {
    var self = this;
    self._assertNotHandled();

    self._delivered = true;
    self._handled = 'delivered';
    self._server._deliverResult(self._result);
}

function delay(milliseconds) {
    var self = this;
    self._assertNotHandled();

    self._handled = 'delayed';
    self._server._timeoutResults.push(self._result);
    self._server._timeoutIds.push(setTimeout(delayedDelivery.bind(self), milliseconds));
}

function stash() {
    var self = this;
    self._assertNotHandled();

    self._handled = 'stashed';
    self._server._stash._addResult(self._result);
}

function delayedDelivery() {
    var self = this;
    var index = self._server._timeoutResults.indexOf(self._result);

    self._server._timeoutResults.splice(index, 1);
    handleResult(self._server, self._result);
}

function assertNotHandled() {
    var self = this;
    if (self._handled) {
        dxLog.fail('Already ' + self._handled + ' this response.');
    }
}

_.extend(Response.prototype, {
    _assertNotHandled: assertNotHandled,
    getData: getData,
    deliver: deliver,
    delay: delay,
    stash: stash
});

/*
 * A Stash is a collection of results that a respond() filter function has decided it doesn't want to have delivered
 * yet.  It persists across respond() calls, but its contents are delivered to the client when the server is reset.
 */
function Stash(server) {
    var self = this;
    self._stash = [];
    self._server = server;
}

function getSize() {
    var self = this;
    return self._stash.length;
}

function addResult(result) {
    var self = this;
    self._stash.push(result);
}

function deliverAll() {
    var self = this;
    var stashCopy = self._stash;
    self._stash = [];
    _.each(stashCopy, function(item) {
        self._server._deliverResult(item);
    });
    $.event.trigger('ajaxComplete');
}

_.extend(Stash.prototype, {
    _addResult: addResult,
    getSize: getSize,
    deliverAll: deliverAll
});

function handleUnknownUrl(server, method, url, settings) {
    /*
     * An unknown URL via a GET is not that uncommon. Some i18n libraries routinely ask for things that don't
     * exit. In these cases, we just want to give them a 404.
     */
    if (method === 'GET') {
        server._handleResult(server._addToResult({ statusCode: 404 }, settings, server._ajaxCallId));
        return;
    }
    /*
     * Logically, this is a 404 situation.  But, also in theory this really shouldn't ever happen.  A thrown error
     * makes it clearer that the developer has done something very un-ok.
     */
    dxLog.fail('The requested resource is not available: ' + method + ':' + url);
}

/*
 * Unless the request was a sync one, the MockServer merely queues results until respond() is called.
 */
function handleResult(server, result) {
    server._reportDebug(result.callId, 'Result: Status ' + result.statusCode, result.data);

    if (result.async === false) {
        server._deliverResult(result);
    } else {
        server._pendingResults.push(result);
    }
}

/*
 * Deliver any queued results.  If a filter function is provided, give it the results first to decide if they should
 * be returned.
 */
function respond(server, filterFunction) {
    if (!_.isUndefined(filterFunction) && !_.isFunction(filterFunction)) {
        dxLog.fail('Filter function, if provided, must be a function.');
    }
    var resultCount = 0;
    var resultSent;

    server._processNotifications();

    if (filterFunction && server._pendingResults.length === 0 && server._stash.getSize() > 0) {
        filterFunction(undefined, server._stash);
    }

    while (server._pendingResults.length > 0) {
        var result = server._pendingResults.shift();
        resultCount++;

        if (filterFunction) {
            var response = new Response(result, resultCount, server);
            filterFunction(response, server._stash);
            resultSent = response._delivered;
            if (!response._handled) {
                dxLog.fail('Must do something with the response.');
            }
        } else {
            resultSent = true;
            server._deliverResult(result);
        }

        // Check if there are any notifications which should be returned.
        server._processNotifications();
    }

    /*
     * notify the system that an ajax call returned. Technically this should be done on every callback, but that drags
     * down our test performance considerably, and doing it once per respond() seems sufficient.
     */
    if (resultSent) {
        $.event.trigger('ajaxComplete');
    }
}

/*
 * This forces a thorough respond, which means any pending longpolls are responded to (with an empty array if
 * necessary), any stashed values are returned, any values waiting for timeouts are also returned.  This was designed
 * to be used in test cleanup to make sure the server is done with any necesary work.
 */
function forceRespond(server) {
    /*
     * If a reset is being done while notification system is active, we want to allow a new longpoll to come in while
     * we are resetting.
     */
    var pendingLongpolls = server._pendingLongpolls.slice(0);
    server._pendingLongpolls = [];
    _.each(pendingLongpolls, function(result) {
        server._deliverResult(_.extend(result, {
            statusCode: 200,
            data: {
                type: 'ListResult',
                result: []
            }
        }));
    });
    _.each(server._timeoutResults, server._deliverResult);
    _.each(server._timeoutIds, clearTimeout);
    server._stash.deliverAll();
    server.respond();

    server._pendingResults = [];
    server._timeoutIds = [];
    server._timeoutResults = [];
    server._ajaxCallId = 0;
}

function MockServer(schemas, filters) {
    var self = this;
    if (!(self instanceof MockServer)) {
        dxLog.fail('Must call MockServer() with new.');
    }
    if (!_.isObject(schemas)) {
        dxLog.fail('Must pass a map of schemas when constructing a server.');
    }

    var server = new AbstractServer(schemas, filters);
    var serverReset = server.reset;

    _.extend(server, {
        _pendingResults: [],
        _timeoutIds: [],
        _timeoutResults: [],
        _stash: new Stash(server),
        _forceRespond: _.partial(forceRespond, server),
        _handleUnknownUrl: _.partial(handleUnknownUrl, server),
        _handleResult: _.partial(handleResult, server),
        respond: _.partial(respond, server),
        reset: function() {
            serverReset.apply(server);
            server._forceRespond();
        }
    });

    return server;
}

module.exports = MockServer;
