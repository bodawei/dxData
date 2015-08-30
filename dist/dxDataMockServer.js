(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

/*global dx, $, _ */

'use strict';

dx.namespace('dx.test');

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
(function() {

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

    var server = new dx.test.ServerCore(schemas);

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

dx.test.AbstractServer = AbstractServer;

})();

},{}],2:[function(require,module,exports){
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

/*global dx, $, _ */

'use strict';

dx.namespace('dx.test');

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
 *    var server = new dx.test.ApiServer(schemas);
 *    server.start();
 *
 * It is best if this is done before anything else has started interacting with the network.
 */
(function() {

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

    var server = new dx.test.AbstractServer(schemas);
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

dx.test.ApiServer = ApiServer;

})();

},{}],3:[function(require,module,exports){
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

/*global dx, _ */

'use strict';

dx.namespace('dx.test');

/*
 * ServerCore provides support for all the data management required of a Delphix Schema-based server (storing objects,
 * responding to operations). It is intended to be used as a base type for various mock servers, allowing subtypes to
 * provide specialized server behavior without needing to re-invent the data and operation management.
 * ServerCore provides support for storing Delphix Schema defined singleton objects and collections of objects, as
 * well as support for the operations defined by those schemas, including  standard operations (read, list, create,
 * update, delete), object operations, and root operations.
 *
 * DATA
 *      createObjects()
 *      updateObjects()
 *      deleteObjects()
 *
 * These three routines add, update and delete objects and singletons in the server, respectively. By default, each
 * also creates the appropriate Notification objects (e.g. object creation notifications) for non-singleton objects,
 * though this can be overridden with a second argument.  The first argument to each can be either an object or an
 * array.
 *
 * When it is an object, it must have this structure:
 *    {
 *        TypeName : [ {
 *            { ... properties ... },
 *            { ... properties ... },
 *            ...
 *        } ],
 *        TypeName : { ... properties ... },
 *        ...
 *    }
 * Each of the "{ ... properties ... }" in the above description is a collection of properties for a particular
 * object instance as defined by the corresponding schema (but it need not be all the properties).
 * TypeName is either a singleton type name, or the name of a type that has a root property or a type descended from
 * a type with a root property.
 * If the individual objects do not have a type property, one will be added using the TypeName value.
 *
 * When it is an array, then it must have this structure:
 *    [{ ... properties ... }, { ... properties ... }, ...]
 *
 * There are some special cases for each of the three functions. In particular:
 *  - createObjects() will automatically add a generated reference property if the object type allows it and one isn't
 *                    provided in the "{ ... properties ... }" declaration
 *  - updateObjects() requires that there be a reference property in each object declaration.
 *  - deleteObjects() Requires a reference property. It can also accept an array of raw object references rather than
 *                    a whole object definition when the argument is an array.
 *
 * Note that these do not do full validation of the values passed in, so if dx.core.data calls fail reporting that
 * invalid properties were received, you should check your object definitions.
 *
 *      getSingleton()
 *      getObject()
 *      getCollection()
 *      clearCollection()
 *      getCollectionLength()
 *
 * These provide access to copies of the objects within the server.
 *
 * OPERATIONS
 *      addResources()
 *
 * This is used to register values that should be returned when a particular URL is GET'ed from the server.
 *
 *      addStandardOpHandlers()
 *      addStandardOpHandler()
 *      addRootOpHandlers()
 *      addRootOpHandler()
 *      addObjectOpHandlers()
 *      addObjectOpHandler()
 *
 * These are used to set up handlers for Standard Operations (list, read, create, update, delete), root operations and
 * object operations as defined by the schemas. The plural forms all take arguments in this form:
 *    {
 *        RootTypeName : {
 *            opName: function() {},
 *            ...
 *        },
 *        ...
 *    }
 * After the operation handler has been installed, any call to that operation on the server will invoke the handler.
 * Note that if a handler already exists in the server, a second addFooOperation call will replace the first.
 * The singular forms all take arguments in this form:
 *    addFooOperation(RootTypeName, operationName, function() {});
 *
 * The handlers take one of the following signatures:
 *    objectHandler(reference, payload, Result, server)
 *        This is for object operations, read, update and delete standard operations.
 *    otherHandler(payload, Result, server);
 *        This is for root operations, list and create standard ops, and singleton read, update and create operations.
 *
 *        reference: The reference of the object being manipulated
 *        payload: The payload of the call (or query parameters)
 *        Result: A constructor function for returning a value. See below
 *        server: A reference to the server making this call to the routine.
 *
 * Each of these functions must return either an arbitrary value, or a Result instance.  If a non-Result instance is
 * returned, the server assumes that it is a successful result, and calls new Result.OkResult(returnValue) for you.
 *
 *     Result(statusCode, data)
 *     Result.OkResult(okResultResult)
 *     Result.ListResult(listResultResult)
 *     Result.ErrorResult(statusCode, errorResultError)
 *     Result.MissingObjResult(type, reference, operation)
 *
 * These constructor functions generate Result instances with an HTTP Status Code and data to be returned to the caller.
 * Result() is the most generic and returns in the body whatever is in the second parameter.
 *
 * URL ACCESS
 *
 *     GET(url, parameters)
 *     POST(url, payload)
 *     DELETE(url, payload)
 *
 * These three routines let you do the equivalent of an HTTP GET, POST or DELETE on the server to the specified URL
 * with the named parameters or payload.  Each returns an object with a statusCode and data property. If the specified
 * url isn't supported by the server, then the return value is equivalent to new Result(server.UNKNOWN_URL_STATUS,
 * undefined);
 */
(function() {

var OBJECT_OPERATION_REGX = new RegExp('(^.*)/([^/]+)/([^/]+)(\\?[^/]+)?$');   // anything/objref/operation?params
var OBJECT_READ_UPDATE_DELETE_REGEX = new RegExp('(^.*)/([^/]+)$');       // anything/something
var INLINE_REF = '/{ref}/';
var TRAILING_REF = '/{ref}';
var START_REF = 1000;
var STANDARD_OPERATONS = ['list', 'read', 'create', 'update', 'delete'];

/*
 * Creates a set of objects in the mock server that can be accessed and manipulated by other operations on the mock
 * server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * In all cases, if the object type allows for a reference property, and that is not included in the object
 *     structure, then this will automatically add one.
 *   * If the object type has a reference, then a corresponding CREATE notification object will be automatically created
 *     unless skipNotifications is true.
 *   * You can "create" a singleton with this call. In that case, it will simply behave the same as an update.
 */
function createObjects(server, newObjects, skipNotifications) {
    return processArgumentsWithHandler(newObjects, skipNotifications, _.partial(createObject, server));
}

/*
 * Given an object, do the following:
 *   - Convert its properties to a JSON-compatible format
 *   - Make sure it is a known schema object type
 *   - Make sure it is a singleton or belongs to a type with a root property
 *   - Add a reference  if appropriate
 *   - Add the object to the mock server's internal cache of objects, replacing any instance already there
 *   - Generate object creation or singleton update notifications if appropriate
 */
function createObject(server, newObject, skipNotification) {
    if (!newObject.type) {
        dx.fail('No type property found on object.', newObject);
    }

    var schema = server._schemasByName[newObject.type];
    if (!schema) {
        dx.fail(newObject.type + ' is not a known schema type.');
    }

    if (schema.singleton) {
        server._singletons[newObject.type] = newObject;

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        var rootType = getRootTypeForObject(schema, server._schemasByName);
        var shouldHaveReference = !!getPropDef(schema, 'reference', server._schemasByName);

        if (!rootType) {
            dx.fail(newObject.type + ' is not a type descended from one with a root property.');
        }

        server._objects[rootType] = server._objects[rootType] || [];
        server._objects[rootType].push(newObject);

        if (shouldHaveReference && !newObject.reference) {
            newObject.reference = newObject.type.toUpperCase() + '-' + server._nextReference;
            server._nextReference++;
        }

        // Notifications only make sense for an object with a reference
        if (newObject.reference && !skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: newObject.type,
                object: newObject.reference
            }]);
        }

        return newObject.reference;
    }
}

/*
 * Updates a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * All non-singleton objects MUST have a reference property set.
 *   * If the object type has a reference or is a singleton, then a corresponding UPDATE notification object will be
 *     automatically created unless skipNotifications is true.
 */
function updateObjects(server, objectsToUpdate, skipNotifications) {
    processArgumentsWithHandler(objectsToUpdate, skipNotifications, _.partial(updateObject, server));
}

function updateObject(server, newObject, skipNotification) {
    var schema = server._schemasByName[newObject.type];

    if (schema && schema.singleton) {
        updateObjectProperties(server, getSingleton(server, newObject.type), newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        if (!newObject.reference) {
            dx.fail('Can not update an object without at least a reference.');
        }
        var existing = getObject(server, newObject.reference);

        if (!existing) {
            dx.fail('There is no object with the reference ' + newObject.reference + ' to update.');
        }

        updateObjectProperties(server, existing, newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: existing.type,
                object: existing.reference
            }]);
        }
    }
}

/*
 * Overlays the target with the new properties while being aware of the fact that objects that have no schema type
 * associated with them should be treated as an "atomic" value and not overlaid but rather replaced as a unit.
 */
function updateObjectProperties(server, targetObject, newProperties) {
    _.each(newProperties, function(propval, propname) {
        if (_.isObject(propval)) {
            var schema = server._schemasByName[targetObject.type];
            var propDef = getPropDef(schema, propname, server._schemasByName);

            if (propDef && propDef.$ref) {
                if (!_.isObject(targetObject[propname])) {
                    targetObject[propname] = {};
                }
                updateObjectProperties(server, targetObject[propname], propval);
                propval = targetObject[propname];
            }
        }
        targetObject[propname] = propval;
    });

    return targetObject;
}

/*
 * Deletes a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 * In addition, if the objectsToDelete is an array, you can simply specify an array of references:
 *    deleteObjects(['REF-1', 'REF-2', 'REF-3'...])
 * This is, far and away, the most common use of this.
 *
 * Note:
 *   * This will throw an error if you try to delete a Singleton.
 *   * All objects MUST have a reference property set.
 *   * A corresponding DELETE notification object will be automatically created unless skipNotifications is true.
 */
function deleteObjects(server, objectsToDelete, skipNotifications) {
    processArgumentsWithHandler(objectsToDelete, skipNotifications, _.partial(deleteObject, server));
}

function deleteObject(server, doomedObjectOrRef, skipNotifications) {
    var targetReference = doomedObjectOrRef;

    if (_.isObject(doomedObjectOrRef)) {
        targetReference = doomedObjectOrRef.reference;
    }

    if (!targetReference) {
        dx.fail('No reference provided to identify the object to delete.');
    }

    if (isSingleton(server, targetReference)) {
        dx.fail('Can not delete singletons (' + targetReference + ' is a singleton).');
    }

    var deletedIt = _.find(server._objects, function(objectsArray) {
        return _.find(objectsArray, function(anObject, index) {
            if (anObject.reference === targetReference) {
                objectsArray.splice(index, 1);

                if (!skipNotifications) {
                    postNotifications(server, [{
                        type: 'ObjectNotification',
                        eventType: 'DELETE',
                        objectType: anObject.type,
                        object: anObject.reference
                    }]);
                }

                return true;
            }
        });
    });

    if (!deletedIt) {
        dx.fail('Could not find ' + targetReference + ' to delete it.');
    }
}

/*
 * Routine that process arguments to several input routines in a uniform way.  The arguments may be in one of two
 * forms:
 *    [{ ... properties ... }, { ... properties ... } ...]
 *  or
 *    {
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        ...
 *    }
 * This will walk through each set of object properties, and call the specified handler with that set of properties
 * and the skipNotifications parameter.  In the case of the latter style, a type property will be added to each
 * individual object if it does not already have one.
 */
function processArgumentsWithHandler(objectsToProcess, skipNotifications, handler) {
    var copyOfObjects = deepClone(objectsToProcess);
    var result = [];

    if (_.isArray(copyOfObjects)) {
        for (var index = 0; index < copyOfObjects.length; index++) {
            result.push(handler(copyOfObjects[index], skipNotifications));
        }
    } else {
        _.each(copyOfObjects, function(objectOrArray, typeName) {
            if (_.isArray(objectOrArray)) {
                for (var ctr = 0; ctr < objectOrArray.length; ctr++) {
                    var anObject = objectOrArray[ctr];
                    anObject.type = anObject.type || typeName;
                    result.push(handler(anObject, skipNotifications));
                }
            } else {
                objectOrArray.type = objectOrArray.type || typeName;
                result.push(handler(objectOrArray, skipNotifications));
            }
        });
    }

    return result;
}

/*
 * Helper function to post an array of notifications.
 */
function postNotifications(server, notifications) {
    server.createObjects({
        Notification: notifications
    }, true);
}

/*
 * Returns the object with the specified reference, or undefined if no such object. If a type is specified, this may
 * use a faster algorithm to look up the object. This does not return singletons.
 */
function getObject(server, objectRef, typeName) {
    if (typeName) {
        var schema = server._schemasByName[typeName];
        if (!schema) {
            dx.fail(typeName + ' is not a known type.');
        }
        var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
        if (!rootTypeName) {
            dx.fail('Can only ask for objects in collections with a root property with getObject().');
        }
        if (rootTypeName !== schema.name) {
            dx.fail('Must specify the root type (' + rootTypeName + ') if a type is specified to getObject().');
        }

        return _.find(server._objects[typeName], function(obj) {
            return obj.reference === objectRef;
        });
    }

    var matchedObject;
    _.find(server._objects, function(collection) {
        matchedObject = _.find(collection, function(anObject) {
            return anObject.reference === objectRef;
        });
        return matchedObject;
    });
    return matchedObject;
}

/*
 * Returns the collection of objects for the specified type. Note that the type must be a root type
 */
function getCollection(server, typeName) {
    var schema = server._schemasByName[typeName];
    if (!schema) {
        dx.fail(typeName + ' is not a known type.');
    }
    if (schema.singleton) {
        dx.fail(typeName + ' is a singleton type, not a collection type.');
    }
    var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
    if (!rootTypeName) {
        dx.fail('Can only ask for collections with a root property.');
    }
    if (rootTypeName !== schema.name) {
        dx.fail('Must specify the root type (' + rootTypeName + ').');
    }

    return server._objects[typeName] || [];
}

/*
 * Returns the specified singleton from the server
 */
function getSingleton(server, typeName) {
    if (!isSingleton(server, typeName)) {
        dx.fail(typeName + ' is not a singleton type.');
    }

    if (!server._singletons[typeName]) {
        server._singletons[typeName] = {
            type: typeName
        };
    }

    return server._singletons[typeName];
}

function isSingleton(server, typeName) {
    var schema = server._schemasByName[typeName];
    return schema && schema.singleton;
}

/*
 * Removes all the elements from the specified collection. No notifications are generated.
 */
function clearCollection(server, typeName) {
    var collection = getCollection(server, typeName);
    collection.length = 0;
}

function getCollectionLength(server, typeName) {
    var collection = getCollection(server, typeName);
    return collection.length;
}

/*
 * Sets the 'standard (CRUD) object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 *
 * You may override any of the standard operations that are supported for a given type. ServerCore already provides
 * default implementations of these handlers, but overriding these may be useful in certain cases, such as testing
 * various failure scenarious as well as being able to spy on these operations.
 * Any operations defined in the parameter will replace their equivalents already installed in the mock server, if any.
 */
function addStandardOpHandlers(server, operationHash) {
    if (!_.isObject(operationHash)) {
        dx.fail('Expected an object, but got ' + JSON.stringify(operationHash) + '.');
    }

    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addStandardOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addStandardOpHandlers(), but instead adds a single operation.
 */
function addStandardOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!_.contains(STANDARD_OPERATONS, opName)) {
        dx.fail(opName + ' is not one of the standard operations (' + STANDARD_OPERATONS.join(', ') + ').');
    }
    if (!server._schemasByName[typeName][opName]) {
        dx.fail(opName + ' is not a standard operation on ' + typeName + '.');
    }

    server._customStdHandlers[typeName] = server._customStdHandlers[typeName] || {};
    server._customStdHandlers[typeName][opName] = opHandler;
}

/*
 * Sets the 'root operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addRootOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addRootOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addRootOpHandlers(), but instead adds a single operation.
 */
function addRootOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].rootOperations || !server._schemasByName[typeName].rootOperations[opName]) {
        dx.fail(opName + ' is not a root operation on ' + typeName + '.');
    }

    server._customRootHandlers[typeName] = server._customRootHandlers[typeName] || {};
    server._customRootHandlers[typeName][opName] = opHandler;
}

/*
 * Adds one or more 'object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addObjectOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addObjectOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addObjectOpHandlers(), but instead adds a single operation.
 */
function addObjectOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].operations || !server._schemasByName[typeName].operations[opName]) {
        dx.fail(opName + ' is not an object operation on ' + typeName + '.');
    }

    server._customObjHandlers[typeName] = server._customObjHandlers[typeName] || {};
    server._customObjHandlers[typeName][opName] = opHandler;
}

/*
 * Adds resources that can be called from a test.  In this case, a resource is an arbitrary string associated with
 * the full path portion of a URL.  This can be useful, for example, to register templates with the mock server that
 * can then be requested from a test.
 *
 * For example, this might be called with:
 * {
 *     '/test/template/basic.hjs': '<div id=basicTest></div>'
 * }
 */
function addResources(server, resourcesHash) {
    _.extend(server._resources, resourcesHash);
}

function HttpGet(server, url, payload) {
    return HttpOperation(server, 'GET', url, payload);
}

function HttpPost(server, url, payload) {
    return HttpOperation(server, 'POST', url, payload);
}

function HttpDelete(server, url, payload) {
    return HttpOperation(server, 'DELETE', url, payload);
}

function HttpOperation(server, method, url, payloadOrParams) {
    var result;
    var path = method + ':' + url;

    if (_.isString(payloadOrParams)) {
        payloadOrParams = JSON.parse(payloadOrParams);
    }

    // Look at the URL and identify candidate handlers.
    var objectOpMatch = OBJECT_OPERATION_REGX.exec(path);
    var objectOpPath = objectOpMatch ? objectOpMatch[1] + INLINE_REF + objectOpMatch[3] : '';
    var objectOpRef = objectOpMatch ? objectOpMatch[2] : '';
    var objectOpHandler = server._builtinHandlers[objectOpPath];

    var objectRUDMatch = OBJECT_READ_UPDATE_DELETE_REGEX.exec(path);
    var objectRUDPath = objectRUDMatch[1] + TRAILING_REF;
    var objectRUDRef = objectRUDMatch[2];
    var objectRUDHandler = server._builtinHandlers[objectRUDPath];

    if (objectOpHandler) {
        result = objectOpHandler(objectOpRef, payloadOrParams, Result, server);
    } else if (server._builtinHandlers[path]) {
        result = server._builtinHandlers[path](payloadOrParams, Result, server);
    } else if (objectRUDHandler) {
        result = objectRUDHandler(objectRUDRef, payloadOrParams, Result, server);
    } else if (server._resources[url] && method === 'GET') {
        result = new Result(200, server._resources[url]);
    } else {
        result = new Result(server.UNKNOWN_URL_STATUS, null);
    }

    // If a handler returned a non-Result, assume it is an OkResult body, and return that instead
    if (!(result instanceof Result)) {
        result = new Result.OkResult(result || null);
    }

    return result;
}

function buildHandlersForSingletonSchema(server, schema) {
    var singletoneType = schema.name;

    if (schema.read) {
        server._builtinHandlers['GET:' + schema.root] = function builtinSingleReadHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(parameters, Result, server) || new Result.OkResult({});
            }

            return new Result.OkResult(getSingleton(server, singletoneType));
        };
    }

    /*
     * Singletons can have only an update or a create, but not both (there is no reference property to distinguish them
     * as there is with ordinary objects)
     */
    if (schema.update || schema.create) {
        server._builtinHandlers['POST:' + schema.root] = function builtinSingleUpdateCreate(payload, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];

            payload = deepClone(payload) || {};
            payload.type = singletoneType;

            if (schema.create) {
                if (customHandlers && customHandlers.create) {
                    return customHandlers.create(payload, Result, server);
                }

                createObject(server, payload);
            } else {
                if (customHandlers && customHandlers.update) {
                    return customHandlers.update(payload, Result, server);
                }

                updateObject(server, payload);
            }

            return new Result.OkResult(null);
        };
    }

    buildRootOperationHandlers(server, schema);
}

function buildHandlersForCollectionSchema(server, schema) {
    buildStandardOperationHandlers(server, schema);
    buildRootOperationHandlers(server, schema);
    buildOperationHandlers(server, schema);
}

function buildStandardOperationHandlers(server, schema) {
    var methodAndUrl;
    var typeName = schema.name;

    if (schema.list) {
        methodAndUrl = 'GET:' + schema.root;

        server._builtinHandlers[methodAndUrl] = function builtinListHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];

            if (customHandlers && customHandlers.list) {
                var result = customHandlers.list(parameters, Result, server);

                // Special case. If the handler returned nothing or a non-result, return a ListResult
                result = result || [];
                if (!(result instanceof Result)) {
                    return new Result.ListResult(result);
                }

                return result;
            }

            var collection = getCollection(server, typeName);

            if (server._filters[typeName]) {
                collection = server._filters[typeName](collection, parameters || {}, typeName, server._schemasByName);
            }

            return new Result.ListResult(collection);
        };
    }

    if (schema.create) {
        methodAndUrl = 'POST:' + schema.root;

        server._builtinHandlers['POST:' + schema.root] = function builtinCreateHandler(payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            var targetType = typeName;
            var payloadSchema;
            var rootTypeName;

            if (customHandlers && customHandlers.create) {
                return customHandlers.create(payload, Result, server);
            }

            if (payload && payload.type) {
                targetType = payload.type;
            }
            payloadSchema = server._schemasByName[targetType];
            if (!payloadSchema) {
                dx.fail(targetType + ' is not a known schema type.');
            }
            rootTypeName = getRootTypeForObject(payloadSchema, server._schemasByName);
            if (rootTypeName !== typeName) {
                dx.fail('Trying to create a ' + typeName + ' but received a payload of type ' + payload.type +
                    '. Use addStandardOpHandlers() to roll your own create logic.');
            }

            var objectsToCreate = {};
            objectsToCreate[typeName] = [payload];

            var references = createObjects(server, objectsToCreate);

            return new Result.OkResult(references[0]);
        };
    }

    if (schema.read) {
        methodAndUrl = 'GET:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinReadHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(reference, payload, Result, server) || new Result.OkResult({});
            }

            var obj = getObject(server, reference, typeName);
            if (!obj) {
                return new Result.MissingObjResult(typeName, reference, 'read');
            }

            return new Result.OkResult(obj);
        };
    }

    if (schema.update) {
        methodAndUrl = 'POST:' + schema.root + TRAILING_REF;
        server._builtinHandlers[methodAndUrl] = function builtinUpdateHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.update) {
                return customHandlers.update(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'update');
            }

            // 'reference' is inferred by the url and must not be part of the data already.
            payload = deepClone(payload);
            payload.reference = reference;

            updateObjects(server, [payload]);

            return new Result.OkResult(null);
        };
    }

    if (schema.delete) {
        methodAndUrl = 'DELETE:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinDeleteHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.delete) {
                return customHandlers.delete(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'delete');
            }

            deleteObjects(server, [reference]);

            return new Result.OkResult(null);
        };
    }
}

function buildOperationHandlers(server, schema) {
    _.each(schema.operations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + INLINE_REF + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinObjHandler(objectRef, payloadOrParams, Result, server) {
            if (!getObject(server, objectRef, schema.name)) {
                return new Result.MissingObjResult(schema.name, objectRef, operationName);
            }

            var customHandlers = server._customObjHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](objectRef, payloadOrParams, Result, server);
            }

            dx.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function buildRootOperationHandlers(server, schema) {
    _.each(schema.rootOperations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + '/' + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinRootOpHandler(payloadOrParams, Result, server) {
            var customHandlers = server._customRootHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](payloadOrParams, Result, server);
            }

            dx.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function Result(statusCode, data) {
    var self = this;

    if (!(self instanceof Result)) {
        dx.fail('Must call Result() with new.');
    }

    self.statusCode = statusCode;
    self.data = data;
}

function OkResult(data) {
    if (!(this instanceof OkResult)) {
        dx.fail('Must call Result.OkResult() with new.');
    }

    return new Result(200, {
        type: 'OKResult',
        result: data
    });
}

function ListResult(data) {
    if (!_.isArray(data)) {
        dx.fail('Must call Result.ListResult() with an array.');
    }
    if (!(this instanceof ListResult)) {
        dx.fail('Must call Result.ListResult() with new.');
    }

    return new Result(200, {
        type: 'ListResult',
        result: data
    });
}

function ErrorResult(statusCode, error) {
    if (!(this instanceof ErrorResult)) {
        dx.fail('Must call Result.ErrorResult() with new.');
    }

    return new Result(statusCode, {
        type: 'ErrorResult',
        status: 'ERROR',
        error: error
    });
}

function MissingObjResult(type, ref, operation) {
    if (!(this instanceof MissingObjResult)) {
        dx.fail('Must call Result.MissingObjResult() with new.');
    }

    return new ErrorResult(404, {
        type: 'APIError',
        details: type + '/' + ref + ' could not be found for ' + operation + '.',
        id: 'object.missing'
    });
}

_.extend(Result, {
    OkResult: OkResult,
    ListResult: ListResult,
    ErrorResult: ErrorResult,
    MissingObjResult: MissingObjResult
});

// Returns the property definition if instances of the specified schema have a specific property, undefined otherwise
function getPropDef(schema, propName, schemasByName) {
    if (schema.properties && schema.properties[propName]) {
        return schema.properties[propName];
    }

    if (schema.extends && schema.extends.$ref) {
        return getPropDef(schemasByName[schema.extends.$ref], propName, schemasByName);
    }
}

// Returns the name of the root type for the specified schema, or undefined.
function getRootTypeForObject(schema, schemasByName) {
    if (schema.root) {
        return schema.name;
    }

    if (schema.extends && schema.extends.$ref) {
        return getRootTypeForObject(schemasByName[schema.extends.$ref], schemasByName);
    }
}

function processSchemas(server, schemas) {
    function fixName(schemaKey) {
        return schemaKey.replace(/\.json$/, '')
            .replace(/-/g, '_')
            .replace(/\//g, '');
    }

    // Fix all the names for all the schemas, and store them by name
    _.each(schemas, function(schema, schemaKey) {
        // don't modify the original schema
        var schemaCopy = deepClone(schema);
        if (!schemaCopy.name) {
            schemaCopy.name = fixName(schemaKey);
        }
        server._schemasByName[schemaCopy.name] = schemaCopy;
    });

    // Fix internal references to the schemas and build the callback handlers for all operations.
    _.each(server._schemasByName, function(schema) {
        if (schema.extends) {
            schema.extends.$ref = fixName(schemas[schema.extends.$ref].name);
        }

        if (schema.root) {
            if (schema.singleton) {
                buildHandlersForSingletonSchema(server, schema);
            } else {
                buildHandlersForCollectionSchema(server, schema);
            }
        }
    });
}

/*
 * Does a deep clone of the specified object, but replaces Date instances with .toJSON() equivalents, and
 * undefined with null.
 */
function deepClone(obj) {
    var result = obj;

    if (_.isArray(obj)) {
        result = [];
        for (var index = 0; index < obj.length; index++) {
            result[index] = deepClone(obj[index]);
        }
    } else if (_.isObject(obj)) {
        if (_.isDate(obj)) {
            result = obj.toJSON();
        } else {
            result = {};
            _.each(obj, function(value, index) {
                if (_.isUndefined(value)) {
                    value = null;
                }
                result[index] = deepClone(value);
            });
        }
    }

    return result;
}

/*
 * Return a function that does a deep clone of the return value
 */
function deepCloneReturn(func, server) {
    return function() {
        // All our functions take the server as their first argument.
        Array.prototype.unshift.call(arguments, server);
        return deepClone(func.apply(server, arguments));
    };
}

function reset(server) {
    server._singletons = {};
    server._objects = {};
    server._nextReference = START_REF;
    server._resources = {};
    server._customObjHandlers = {};   // { type: { op: function() } }
    server._customRootHandlers = {};
    server._customStdHandlers = {};
}

/*
 * Document structure of schemas
 */
function ServerCore(schemas) {
    var self = this;
    if (!(self instanceof ServerCore)) {
        dx.fail('Must call ServerCore() with new.');
    }
    if (!schemas) {
        dx.fail('Must pass a map of schemas when constructing a ServerCore.');
    }

    self._schemasByName = {};
    self._builtinHandlers = {}; // 'HTTPMMETHOD:url': function()
    self._filters = [];
    reset(self);

    processSchemas(this, schemas);

    _.extend(self, {
        UNKNOWN_URL_STATUS: 1000,
        createObjects: _.partial(createObjects, self),
        updateObjects: _.partial(updateObjects, self),
        deleteObjects: _.partial(deleteObjects, self),
        getObject: deepCloneReturn(getObject, self),
        getSingleton: deepCloneReturn(getSingleton, self),
        getCollection: deepCloneReturn(getCollection, self),
        clearCollection: _.partial(clearCollection, self),
        getCollectionLength: _.partial(getCollectionLength, self),
        addStandardOpHandlers: _.partial(addStandardOpHandlers, self),
        addStandardOpHandler: _.partial(addStandardOpHandler, self),
        addRootOpHandlers: _.partial(addRootOpHandlers, self),
        addRootOpHandler: _.partial(addRootOpHandler, self),
        addObjectOpHandlers: _.partial(addObjectOpHandlers, self),
        addObjectOpHandler: _.partial(addObjectOpHandler, self),
        addResources: _.partial(addResources, self),
        GET: deepCloneReturn(HttpGet, self),
        POST: deepCloneReturn(HttpPost, self),
        DELETE: deepCloneReturn(HttpDelete, self),
        reset: _.partial(reset, self)
    });
}

dx.test.ServerCore = ServerCore;

})();

},{}],4:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _ */

'use strict';

dx.namespace('dx.test._filters');

/*
 * Defines a set of filter helper functions for delphix schema root types to be used by the Mock Server.
 * New filters should be added here, with each filter named by the root type.
 *
 * mockCollectionFilters differ from level2-filters in a number of ways:
 * 1. These are synchronous, as the mockServer is written synchronously. level2-filters are async.
 * 2. These deal with plain objects, while level2-filters must deal with Backbone models.
 * 3. These have a global view of the objects in the system, and can thus deal with things like paging, whereas
 *    level2-filters can not.
 *
 * Many filters can be autogenerated from the schemas and schema annotations defined in level1-schema.js. These use the
 * uberFilter. However, there are still some types which cannot be autogenerated due to complex logic which cannot be
 * inferred from the schema.
 *
 * Each filter function takes in a collection and a hash of query parameters, and will return the filtered version of
 * the collection.
 *
 * Note: These filters should be kept in sync with level2-filters.
 */
(function() {

var DATE_PROPS = ['fromDate', 'startDate', 'toDate', 'endDate'];

function missingObject(type, reference) {
    dx.fail('The ' + type + ' (' + reference + ') does not exist in the mock server and is needed to filter your ' +
            '$$list operation.');
}

// Parse the 'mapsTo' property for the query parameter and follow the data mapping chain
function followDataMapping(object, mapsTo, parsedSchemas) {
    var parts = mapsTo.split('.');

    // We know the last part will be property to compare. Anything before that will be a chain of object dereferencing
    var finalAttrName = parts.pop();

    var currObj = object;
    _.each(parts, function(part) {
        var type = parsedSchemas[currObj.type].properties[part].referenceTo;

        var newObj = dx.test.mockServer.getObject(currObj[part], type);
        if (!newObj) {
            missingObject(type, currObj[part]);
        }

        currObj = newObj;
    });

    return { object: currObj, attrName: finalAttrName };
}

/*
 * Helper for a single query parameter. Will follow a data mapping and check that the qParam value matches the object's
 * property value.
 */
function checkSimpleProp(qParamVal, qParamName, objectSchema, object, parsedSchemas) {
    var mapsTo = objectSchema.list.parameters[qParamName].mapsTo;
    if (!mapsTo) {
        dx.fail('No mapsTo property found for query parameter ' + qParamName + '.');
    }

    var pair = followDataMapping(object, mapsTo, parsedSchemas);
    var finalObj = pair.object;
    var finalAttrName = pair.attrName;

    return qParamVal === finalObj[finalAttrName];
}

/*
 * Helper for a single query parameter. Will follow a data mapping and check a date-related query parameter.
 */
function checkDateProp(qParamVal, qParamName, objectSchema, object, parsedSchemas) {
    var mapsTo = objectSchema.list.parameters[qParamName].mapsTo;
    if (!mapsTo) {
        dx.fail('No mapsTo property found for query parameter ' + qParamName);
    }

    if (!_.contains(DATE_PROPS, qParamName)) {
        dx.fail('Expected a date related query parameter (' + DATE_PROPS.join(', ') + ') but found: ' + qParamName);
    }

    var inequalityType = objectSchema.list.parameters[qParamName].inequalityType;

    if (_.isUndefined(inequalityType)) {
        dx.fail('Date property "' + qParamName + '" missing "inequalityType" schema property');
    }

    var pair = followDataMapping(object, mapsTo, parsedSchemas);
    var finalObj = pair.object;
    var finalAttrName = pair.attrName;

    // Since we are at the mockServer level, the query parameters passed in may be timestamps, not Date objects
    if (!_.isDate(qParamVal)) {
        qParamVal = new Date(qParamVal);
    }

    // Handle the case where this is a timestamp string as well as a Date object
    var objAttrVal = finalObj[finalAttrName];
    if (_.isString(objAttrVal)) {
        objAttrVal = new Date(objAttrVal);
    }

    if (dx.core.util.isNone(objAttrVal)) {
        return false;
    }

    if (_.contains(['fromDate', 'startDate'], qParamName)) {
        if (objAttrVal.getTime() < qParamVal.getTime()) {
            return false;
        }
    } else if (objAttrVal.getTime() > qParamVal.getTime()) { // toDate or endDate
        return false;
    }

    if (inequalityType === dx.core.constants.INEQUALITY_TYPES.STRICT && objAttrVal.getTime() === qParamVal.getTime()) {
        return false;
    }

    return true;
}

/*
 * Helper to determine if a mock server object should be included given it's index and paging parameters.
 * Note that this assumes not specifying a page size implicitly sets it to a particular size (generally 25),
 * while specifying 0 means 'all'.
 */
function checkPageSize(qParams, objectIndex, collectionLength) {
    var start, end, pageSize, pageOffset;

    if (qParams.pageSize === 0) {
        return true;
    }

    pageSize = qParams.pageSize || 25;
    pageOffset = qParams.pageOffset || 0; // No pageOffset gives you the page with the most recent data

    if (pageSize < 0) {
        dx.fail('pageSize must be a positive integer');
    }

    if (pageOffset >= 0) {
        end = collectionLength - pageSize * pageOffset - 1;
        start = Math.max(0, end - pageSize + 1);
    } else {
        // Negative offset takes the page from the older end of the collection, with -1 being the oldest
        start = pageSize * -(pageOffset + 1);
        end = Math.min(collectionLength - 1, start + pageSize - 1);
    }

    return objectIndex >= start && objectIndex <= end;
}

/*
 * Check an array of query parameters against an object.
 */
function checkProps(qParamNamesToCheck, qParams, object, objectSchema, parsedSchemas) {
    return _.every(qParamNamesToCheck, function(qParamName) {
        if (!_.has(qParams, qParamName)) {
            return true;
        }

        var dateParams = ['fromDate', 'startDate', 'toDate', 'endDate'];
        var qParamVal = qParams[qParamName];

        if (_.contains(dateParams, qParamName)) {
            return checkDateProp(qParamVal, qParamName, objectSchema, object, parsedSchemas);
        } else {
            return checkSimpleProp(qParamVal, qParamName, objectSchema, object, parsedSchemas);
        }
    });
}

/*
 * One filter to rule them all, one filter to find them,
 * One filter to bring them all and in the darkness bind them.
 *
 * In the days of old there were many filters freely roaming the land. At the end of the second age, schema annotations
 * were introduced into level1-schemas.js. This gave the dark lord all the tools he needed to corral the filters into a
 * single uberFilter, thus beginning a period of darkness and code maintainability. However, a few misfit filters
 * managed to escape the all seeing gaze of the dark lord, their logic simply too complex to be handled by the
 * uberFilter.
 */
function uberFilter(collection, qParams, collectionType, parsedSchemas) {
    parsedSchemas = parsedSchemas || dx.core.data.parsedSchemas;
    var objectSchema = parsedSchemas[collectionType];

    return _.filter(collection, function(object) {
        return checkProps(_.keys(qParams), qParams, object, objectSchema, parsedSchemas);
    });
}

/*
 * uberFilter needs the type to get schema information. This wraps uberFilter and returns a function that conforms to
 * the signature expected by mockServer.
 */
function makeUberFilter(type) {
    return function wrappedUberFilter(collection, qParams) {
        return uberFilter(collection, qParams, type);
    };
}

/*
 * Wraps an individual filter function to take care of logic around paging.
 */
function maybeAddPagingToFilter(type, filterFunc, context) {
    var ctx = context || dx.core.data;
    var supportsPaging = 'pageSize' in ctx.parsedSchemas[type].list.parameters;

    return function wrappedFilter(collection, qParams) {
        var pagingParams,
            result = collection;

        // Separate paging parameters from other parameters
        pagingParams = _.pick(qParams, 'pageSize', 'pageOffset');
        qParams = _.omit(qParams, 'pageSize', 'pageOffset');

        result = filterFunc(collection, qParams);

        if (supportsPaging) {
            result = _.filter(result, function(object, index) {
                return checkPageSize(pagingParams, index, result.length);
            });
            // The most recent result should be the first (index 0) in the list
            result.reverse();
        }

        return result;
    };
}

_.extend(dx.test._filters, {
    _uberFilter: uberFilter,
    makeUberFilter: makeUberFilter,
    missingObject: missingObject,
    checkProps: checkProps,
    maybeAddPagingToFilter: maybeAddPagingToFilter
});

})();

},{}],5:[function(require,module,exports){
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

/*global dx, $, _ */

'use strict';

dx.namespace('dx.test');

/*
 * Defines a MockServer which responds to $.ajax calls, and then stores results until a caller/test calls respond().
 * This allows tests to make use of asynchronous behavior without actually creating asynchronous tests.
 *
 * An example use is:
 *
 *    it('does something wonderful', function() {
 *        var mockServer = new dx.test.MockServer(MY_SCHEMAS);
 *        mockServer.start();
 *
 *        var promise = dx.core.data.getServerModelPromise('CONTAINER-1', 'Container');
 *        promise.then(function() {});
 *
 *        // Note that this has "sent" an "asynchronous" request to the MockServer
 *        dx.test.assert(promise).not.toHaveBeenCalled();
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
(function() {

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
        dx.fail('Already ' + self._handled + ' this response.');
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
    dx.fail('The requested resource is not available: ' + method + ':' + url);
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
        dx.fail('Filter function, if provided, must be a function.');
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
                dx.fail('Must do something with the response.');
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

function MockServer(schemas) {
    var self = this;
    if (!(self instanceof MockServer)) {
        dx.fail('Must call MockServer() with new.');
    }
    if (!_.isObject(schemas)) {
        dx.fail('Must pass a map of schemas when constructing a server.');
    }

    var server = new dx.test.AbstractServer(schemas);
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

dx.test.MockServer = MockServer;
})();

},{}]},{},[1,2,3,4,5])
//# sourceMappingURL=dxDataMockServer.js.map
