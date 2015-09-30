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

/*global $, require */

'use strict';

var ServerCore = require('./ServerCore.js');
var _ = require('underscore');

/*
 * This is an abstract supertype which provides common behavior for starting and stopping a mock server as well as
 * jQuery compatible behavior for receiving calls to $.ajax() making calls to ServerCore, and making calls back to
 * through the jQuery callbacks.  What this doesn't provide is exactly how the server reacts between the return from
 * the ServerCore call(s) and making the callbacks to the jQuery callbacks. That is the primary area for subtypes to
 * augment this.
 *
 * When a server is started, it replaces the standard jQuery ajax function with its own, and thereafter processes those
 * queries. It redirects the call as appropriate to the ServerCore, and then asks subtypes to decide what to do with
 * the Result that comes back from that.
 *
 * This provides a set of routines for subtypes to use to process and ultimately deliver results to the callers.
 */

var JSON_MIME_TYPE = 'application/json';
var TEXT_MIME_TYPE = 'text/plain';

// Mapping of HTTP status codes to text. https://www.ietf.org/rfc/rfc2616.txt
var HTTP_STATUS_TEXT = {
    100: 'Continue',
    101: 'Switching Protocol',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    306: '(Unused)',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'Internal Server Error'
};

/*
 * Replacement for jQuery's ajax function.  This handles these aspects of jquery's behavior:
 * It will then pass the url and settings.data on to ServerCore, and then ask subtypes to deal with the Result.
 * This also does provide the notification long poll support.
 */
function replacementAjaxHandler(url, settings) {
    var self = this;

    // parameters can be $.ajax(settings) or $.ajax(url, settings)
    if (_.isObject(url)) {
        settings = url;
        url = settings.url;
    }
    var messageBody = settings.data;
    var isNotificationCall = url.indexOf(self._notificationUrl) !== -1;
    var method = settings.type || 'GET';    // default to GET if needed.
    method = method.toUpperCase();

    self._ajaxCallId++;
    self._reportDebug(self._ajaxCallId, 'Receive ' + method + ':' + url);

    if (isNotificationCall) {
        self._pendingLongpolls.push(addToResult({}, settings, self._ajaxCallId));
    } else {
        var result = self[method](url, messageBody);

        if (result.statusCode === self.UNKNOWN_URL_STATUS) {
            self._handleUnknownUrl(method, url, settings);
        } else {
            self._handleResult(addToResult(result, settings, self._ajaxCallId));
        }
    }
}

// Given a Response object, create a duck-typed jQuery XHR
function PseudoXhr(result) {
    var self = this;

    self.readyState = 4;
    self.status = result.statusCode;
    self.statusText = HTTP_STATUS_TEXT[result.statusCode];

    // In the majority of cases, responseText is never evaluated, so lazily compute it (since it may involve stringify)
    Object.defineProperty(self, 'responseText', {
        get: function() {
            if (result.dataText) {
                return result.dataText;
            }

            if (_.isString(result.data)) {
                return result.data;
            }

            return JSON.stringify(result.data);
        },
        enumerable: true
    });
}

// dxData calls this under error circumstances to check the data type of the return
PseudoXhr.prototype.getResponseHeader = function getResponseHeader(header) {
    var self = this;

    if (header.toLowerCase() === 'content-type') {
        if (parseJSON(self.responseText) instanceof Error) {
            return TEXT_MIME_TYPE;
        }
        return JSON_MIME_TYPE;
    }

    return '';
};

// Augment a result object with other (private) information that this will need later to deliver the Result to callbacks
function addToResult(result, settings, callId) {
    result.async = settings.async;
    result.dataType = settings.dataType && settings.dataType.toUpperCase();
    result.success = settings.success;
    result.error = settings.error;
    result.status = settings.statusCode && settings.statusCode[result.statusCode];
    result.callId = callId;

    return result;
}

/*
 * Overridable routine that lets a subtype do something with each result.
 * Expected parameters: result
 */
function handleResult() {
    dx.fail('handleResult() must be overridden.');
}

/*
 * Overridable routine to cope with a call that the ServerCore couldn't handle
 * Expected parameters: method, url, settings
 */
function handleUnknownUrl() {
    dx.fail('handleUnknownUrl() must be overridden.');
}

/*
 * Given a result (decorated with the information from addToResult()) process it and deliver to the client.
 */
function deliverResult(server, result) {
    if (result.statusCode >= 200 && result.statusCode < 300 || result.statusCode === 304) {
        /*
         * Most of the time, the mock server returns data as a JavaScript object (not truly JSON). However, one can add
         * a JavaScript file as a resource and retrieve it, in which case we will receive a true JSON value.  If the
         * client told us it was expecting JSON data, mimic jQuery's behavior, parse the JSON and return the result.
         */
        if (result.dataType === 'JSON' && _.isString(result.data)) {
            var parsing = parseJSON(result.data);
            if (parsing instanceof Error) {
                invokeCallbacks(server, result, 'parsererror', parsing);
                return;
            } else {
                result.dataText = result.data;
                result.data = parsing;
            }
        // if the client is asking for a script, mimic jQuery and eval it.
        } else if (result.dataType === 'SCRIPT') {
            var evalResult = evalJavaScript(result.data);
            if (evalResult instanceof Error) {
                invokeCallbacks(server, result, 'parsererror', evalResult);
                return;
            }
        }
        invokeCallbacks(server, result, 'success');
    } else {
        invokeCallbacks(server, result, 'error');
    }
}

function invokeCallbacks(server, result, status, errorObject) {
    var xhr = new PseudoXhr(result);
    var count = 0;
    var callbacks = [].concat(result.status);
    if (status === 'success') {
        _.each(callbacks.concat(result.success), function(cb) {
            if (cb) {
                cb(result.data, 'success', xhr);
                count++;
            }
        });
    } else {
        _.each(callbacks.concat(result.error), function(cb) {
            if (cb) {
                cb(xhr, status, errorObject || xhr.statusText);
                count++;
            }
        });
    }

    server._reportDebug(result.callId, (count > 0) ? 'Deliver ' + status : 'No callbacks');
}

/*
 * Parse a JSON string and either return the parsed result or an Error instance.  This is done as a separate routine
 * to limit the impact of the try-catch block which in some browsers makes the routine something it can't optimize.
 */
function parseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return error;
    }
}

/*
 * Eval a string as JavaScript.  This is in a separate routine to limit the non-optimizability of the try-catch block.
 */
function evalJavaScript(javaScriptString) {
    try {
        $.globalEval(javaScriptString);
    } catch (error) {
        return error;
    }
}

function findNotificationUrlBase(schemas) {
    var notificationSchema = _.find(schemas, function(schema) {
        return schema.name === 'Notification';
    });

    if (!notificationSchema || !notificationSchema.root) {
        dx.fail('Schemas do not include a Notification type.');
    }

    return notificationSchema.root;
}

/*
 * Handle longpoll notifications. If there are notifications to be delivered and there are open longpoll
 * requests, then deliver those results to the longpoll calls.
 */
function processNotifications(server) {
    if (server.getCollectionLength('Notification') && server._pendingLongpolls.length > 0) {
        var result = server.GET(server._notificationUrl);
        server.clearCollection('Notification');

        _.each(server._pendingLongpolls, function(resultExtras) {
            var fullResult = _.extend(_.clone(result), resultExtras);
            server._handleResult(fullResult);
        });
        server._pendingLongpolls = [];
    }
}

/*
 * Report a debug message
 */
function reportDebug(server, callId, message, data) {
    if (!server.debug) {
        return;
    }

    // Special case OK and List results. Just show the returned data
    if (data && data.result) {
        data = data.result;
    }
    var jsonData = data ? ' ' + JSON.stringify(data) : '';
    if (jsonData.length > 100) {
        jsonData = jsonData.substr(0, 100) + '...';
    }

    dx.debug('Call ' + callId + ': ' + message + jsonData);
}

/*
 * Start the server, by redirecting all jquery ajax calls to it.
 */
function startMockServer() {
    var self = this;
    if ($.ajax === self._currentAjax) {
        dx.fail('This server is already started.');
    }
    self._previousAjax = $.ajax;

    // create a unique function as our handler, and make sure it has ourself as its 'this'
    $.ajax = replacementAjaxHandler.bind(self);

    // Record which $.ajax function we're associated with
    self._currentAjax = $.ajax;
}

/*
 * Turn off the server, restoring ajax traffic to wherever it would have gone before.
 */
function stopMockServer() {
    var self = this;
    if (!self._previousAjax) {
        dx.fail('This server has not been started.');
    }
    // Check if $.ajax is our function, or is a jasmine spy on our function.
    if ($.ajax !== self._currentAjax && $.ajax.originalValue !== self._currentAjax) {
        dx.fail('This server is not the active $.ajax handler, and so can not be stopped.');
    }

    /*
     * Ick ick ick ick.  If a test spys on ajax, and then this mock server is stopped, this will replace the original
     * handler, and then when the test ends, Jasmine will return the "currentAjax" value back to $.ajax.  There is no
     * way to avoid this using Jasmine except to always put a spy on $.ajax in jasmineSetup, and then having the mock
     * servers work with that, which leads to other ugliness.  Instead, we just notice that there is a spy here, and
     * replace the value it will restore at the end of the test.
     */
    if ($.ajax.originalValue === self._currentAjax) {
        $.ajax.originalValue = self._previousAjax;
    }

    // undo our starting
    $.ajax = self._previousAjax;
    delete self._currentAjax;
    delete self._previousAjax;
}

function AbstractServer(schemas) {
    var self = this;
    if (!(self instanceof AbstractServer)) {
        dx.fail('Must call AbstractServer() with new.');
    }
    if (!_.isObject(schemas)) {
        dx.fail('Must pass a map of schemas when constructing a server.');
    }

    var server = new ServerCore(schemas);

    _.extend(server, {
        _pendingLongpolls: [],
        _notificationUrl: findNotificationUrlBase(schemas),
        _ajaxCallId: 0,
        debug: false,
        _handleUnknownUrl: handleUnknownUrl,
        _handleResult: handleResult,
        _processNotifications: _.partial(processNotifications, server),
        _deliverResult: _.partial(deliverResult, server),
        _reportDebug: _.partial(reportDebug, server),
        _addToResult: addToResult,
        start: startMockServer,
        stop: stopMockServer
    });

    return server;
}

module.exports = AbstractServer;
