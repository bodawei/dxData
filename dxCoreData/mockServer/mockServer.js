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
 * Copyright (c) 2013, 2015 by Delphix. All rights reserved.
 */

/*global dx, $, _, delphixSchema, jasmine */

'use strict';

dx.namespace('dx.test.mockServer');

/*
 * This provides an interface to a mock server to be used for testing purposes. When installed, this replaces the
 * $.ajax() function thus intercepting all calls that would have been directed to a Delphix server. It then redirects
 * all these queries to handlers within itself. Some handlers (e.g. CRUD operations on the objects provided by the
 * server) are pre-defined. Others can be defined by tests to provide test-specific results.
 *
 * This mock server is used in one of two contexts: unit context or integration context. When used in unit context, the
 * responses from those $.ajax() calls are queued, and can later be delivered to the client with respond(), thus
 * providing asynchronous semantics within tests. In integration context, responses are delivered asynchronously as
 * they would be from a real server.
 *
 * Once this file is loaded, it overrides $.ajax() functionality permanently.
 *
 * The following methods are provided to configure server side state in unit context, described in more detail above
 * each declaration:
 *
 *      setObjects()
 *      addStandardOperations()
 *      addRootOperations()
 *      addObjectOperations()
 *      setResources()
 *
 * When used in integration context, the following should be used instead:
 *
 *      createObjects()
 *      deleteObjects()
 *      updateObjects()
 */
(function () {
var INLINE_REF = '/{ref}/';
var TRAILING_REF = '/{ref}';
var MOCK_SERVER_RESPONSE_TYPE = 'MockServerResponse';

// data and operations provided by the client
var objects = {};
var standardOperations = {};
var rootOperations = {};
var objectOperations = {};
var resources = {};

// our own arrays of functions to handle schema operations
var staticHandlers = {};
var rootOpHandlers = {};
var objectOpHandlers = {};
var objectHandlers = {};  // object Read Update and Delete handlers

var objectOperationRegex = '(^.*)/([^/]+)/([^/]+)$';
var objectRegEx = '(^.*)/([^/]+)$';
var START_REF = 1000;
var nextReference = START_REF; // Start high to avoid conflict with common test IDs
var pendingCallbacks = [];
var callCount = 0;
var pendingNotificationCallback;
var browserMode = false;

/*
 * Wrappers to invoke a callback synchronously or asynchronously. If the caller explicitly requests sync behavior, then
 * we always invoke it synchronously. Otherwise, we check to see whether we are in async mode (browser integration
 * test) or sync mode (test context).
 * Note: success vs. error have different params here. This reflects the arguments jQuery passes to success and
 * error callbacks.
 */
function runSuccessCallback(config, callback, data, textStatus, xhr) {
    if (dx.test.mockServer.debug) {
        dx.debug('Call successful. ' + config.url, config);
    }
    if (callback) {
        if (dx.test.mockServer.debug) {
            dx.debug('Queueing result. ' + config.url + ' ' + JSON.stringify(data), data, config);
        }
        var docall = function() {
            if (dx.test.mockServer.debug) {
                dx.debug('Sending result.  ' + config.url + ' ' + JSON.stringify(data), data, config);
            }
            callback(data, textStatus, xhr);
        };

        runOrScheduleCallback(config, docall);
    }
}

function runErrorCallback(config, callback, xhr, textStatus) {
    if (dx.test.mockServer.debug) {
        dx.debug('Call failed. ' + config.url, xhr, config);
    }
    if (callback) {
        if (dx.test.mockServer.debug) {
            dx.debug('Queueing error result.' + JSON.stringify(xhr), xhr, config);
        }
        var docall = function() {
            if (dx.test.mockServer.debug) {
                dx.debug('Delivering result: ' + JSON.stringify(xhr) + ' for ' + config.url, xhr, config);
            }
            callback(xhr, textStatus);
        };

        runOrScheduleCallback(config, docall);
    }
}

/*
 * Called by run[Success|Error]Callback() to do the actual work of scheduling or running the callback
 */
function runOrScheduleCallback(config, callback) {
    if (_.isUndefined(config.async) || config.async) {
        if (!browserMode) {
            pendingCallbacks.push(callback);
        } else {
            setTimeout(callback, 0);
        }
    } else {
        callback();
    }
}

function makeOkResult(result) {
    return {
      type: 'OKResult',
      result: result
    };
}

function makeListResult(result) {
    return {
      type: 'ListResult',
      result: result
    };
}

function makeObjectMissingResult(type, ref, operation) {
    return {
        'type':'ErrorResult',
        'status':'ERROR',
        'error': {
            'type':'APIError',
            'details':'Could not find the object ' + type + '/' + ref + ' when doing a ' + operation + ' operation.',
            'action':'Check your test',
            'id':'object.missing',
            'commandOutput':null
        }
    };
}

/*
 * Convenience factory method for creating a mock Xhr object
 */
function makeMockXhr(statusCode, statusText, responseText) {
    return new MockXhr(statusCode, statusText, responseText);
}

function MockXhr(statusCode, statusText, responseText) {
    this.readyState = 4;
    this.status = statusCode;
    this.statusText = statusText;
    this.responseText = responseText;
}

MockXhr.prototype.getResponseHeader = function(header) {
    if (header.toLowerCase() === 'content-type') {
        try {
            JSON.parse(this.responseText);  // see if we can parse it as JSON
            return 'application/json';
        } catch (e) {
            return 'text/plain';
        }
    }
};

/*
 * Provides a hook for the developer to take more control over the mock server's response. Falls back on default values
 *
 * data (POJO): contains the response data
 * xhrProperties (POJO): overlay any of the following properties on top of the defaults (see makeMockXhr):
 *           status (int),
 *           statusText (String),
 *           responseText (String)
 * statusText (String): Status message to deliver to the ajax callback
 *
 * NOTE: this will not automatically wrap the data in an OKResult, ListResult, etc. This must be done manually.
 *
 * Simple example: mocking an ErrorResult:
 *
 *           dx.test.mockServer.addRootOperations({
 *              SomeSchemaType: {
 *                  someRootOperation: function(options) {
 *                      return dx.test.mockServer.makeMockServerResponse({
 *                          type: 'ErrorResult'
 *                      });
 *                  }
 *              }
 *          });
 *
 * Example: customizing xhr fields:
 *
 *          dx.test.mockServer.addRootOperations({
 *              SomeSchemaType: {
 *                  someRootOperation: function(options) {
 *                      return dx.test.mockServer.makeMockServerResponse({
 *                          type: 'ErrorResult'
 *                      }, {
 *                          status: 500,
 *                          statusText: 'Internal Server Error',
 *                          responseText: 'Something bad happened!'
 *                      },
 *                      'You Lose');
 *                  }
 *              }
 *          });
 */
function publicMakeMockServerResponse(data, xhrProperties, statusText) {
    var xhr = makeMockXhr(200, '', '');
    _.extend(xhr, xhrProperties || {});

    return {
        type: MOCK_SERVER_RESPONSE_TYPE,
        data: data || {},
        statusText: statusText || xhr.statusText,
        xhr: xhr
    };
}

/*
 * Define an internal type to return http error information to the ajax routine so it can report to it to the caller.
 */
function InternalHttpError(message, statusCode, error, responseText) {
    this.message = message;
    this.statusCode = statusCode;
    this.error = error;
    this.responseText = responseText;
}
InternalHttpError.prototype = new Error();
InternalHttpError.prototype.constructor = InternalHttpError;

/*
 * Checks whether an object with the specified reference, exists in the specified type of collection
 */
function objectExistsInType(objectRef, typeName) {
    return _.find(getCollection(typeName), function(o) { return o.reference == objectRef; }) ? true : false;
}

function mockServerAjaxHandler(config) {
    callCount++;

    if (dx.test.mockServer.debug) {
        dx.debug('Received call:   ' + config.url + ' (' + config.type + ')', config);
    }

    /*
     * We use the 'emulateHTTP' setting in backbone, so we need to handle the backbone implementation that sets
     * 'X-HTTP-Method-Override' through the beforeSend() callback.
     */
    if (config.beforeSend) {
        config.beforeSend({
            setRequestHeader: function(hdr, value) {
                if (hdr == 'X-HTTP-Method-Override' && value == 'DELETE') {
                    config.type = 'DELETE';
                }
            }
        });
    }

    var isList = false;
    var operationType = config.type ? config.type.toUpperCase() : 'GET';
    var path = operationType + ':' + config.url;

    if (_.isString(config.data)) {
        config.data = JSON.parse(config.data);
    }

    var ooMatch = new RegExp(objectOperationRegex).exec(path);
    var ooPath = '';
    var ooObjectRef = '';
    if (ooMatch !== null) {
        ooPath = ooMatch[1] + INLINE_REF + ooMatch[3];
        ooObjectRef = ooMatch[2];
    }

    var objectMatch = new RegExp(objectRegEx).exec(path);
    var objectPath = '';
    var objectObjectRef = '';
    if (objectMatch !== null) {
        objectPath = objectMatch[1] + TRAILING_REF;
        objectObjectRef = objectMatch[2];
    }

    function handleResultObj(result) {
        if (result && result.type === MOCK_SERVER_RESPONSE_TYPE) {
            var status = result.xhr.status;
            if (status >= 200 && status < 300 || status === 304) {
                runSuccessCallback(config, config.success, result.data, result.statusText, result.xhr);
            } else {
                runErrorCallback(config, config.error, result.xhr, result.statusText);
            }
        } else {
            // If we get this far, we have to have handled the request successfully
            result = dx.core.util.deepClone(result);
            var okResult = isList ? makeListResult(result) : makeOkResult(result);
            runSuccessCallback(config, config.success, okResult, 'success', makeMockXhr(200, 'OK', okResult));
        }
    }

    function runAjax() {
        var result;
        try {
            if (rootOpHandlers[path]) {
                result = rootOpHandlers[path](config);
            } else if (objectOpHandlers[ooPath]) {
                result = objectOpHandlers[ooPath](ooObjectRef, config);
            } else if (staticHandlers[path]) {
                result = staticHandlers[path](config);
                if (_.isArray(result)) {
                    isList = true;
                }
            } else if (objectHandlers[objectPath]) {
                result = objectHandlers[objectPath](objectObjectRef, config);
            } else if (operationType === 'GET' && resources[config.url]) {
                var data = resources[config.url];
                if (config.dataType == 'script') {
                    // Script files are expected to be loaded by jQuery
                    try {
                        $.globalEval(data);
                    } catch (e) {
                        runErrorCallback(config, config.error,
                            makeMockXhr(500, e, e.toString()), 'error');
                        return;
                    }
                }
                runSuccessCallback(config, config.success, data, 'success',
                    makeMockXhr(200, 'OK', resources[config.url]));
                return;
            } else if (browserMode) {
                /*
                 * In browser mode we pass through to the real jQuery ajax. This is necessary so that we can dynamically
                 * load scripts even when the mock server is loaded. We invoke the publicly visible version so that
                 * its behavior can be overridden for unit tests.
                 */
                return dx.test.mockServer.jQueryAjax(config);
            } else if (operationType === 'GET' && !resources[config.url]) {
                throw new InternalHttpError('Tried to get a resource that doesn\'t exist (' + config.url + ')',
                    404, 'Not found');
            } else {
                /*
                 * Logically, this is a 404 situation.  But, also in theory this really shouldn't ever happen.  An
                 * exception makes it clearer that the developer has done something very unok
                 */
                dx.fail('The requested resource is not available: ' + path);
            }
        } catch (err) {
            if (err instanceof InternalHttpError) {
                runErrorCallback(config, config.error, makeMockXhr(err.statusCode, err.error, err.responseText),
                    'error');
                // Try to mimic the whole ajax behavior on errors.
                if (config.statusCode && config.statusCode['404']) {
                    runErrorCallback(config, config.statusCode[err.statusCode],
                        makeMockXhr(err.statusCode, err.error, err.responseText), 'error');
                }
                return;
            } else {
                throw err;
            }
        }

        // Result is a promise
        if (!dx.core.util.isNone(result) && _.isFunction(result.done)) {
            result.done(function(res) {
                handleResultObj(res);
            });
        } else {
            handleResultObj(result);
        }
    }

    /*
     * Object notifications are special when in browser mode. Here, we don't want to return immediately, but only when
     * notifications are available. Normally this customized behavior would rest at the mock integration level, but we
     * can't get the result and return it later, we need to actually defer execution. Therefore this needs to be
     * managed at the mock server level.
     */
    if (browserMode && (path == 'GET:' + delphixSchema['/delphix-notification.json'].root)) {
        /*
         * This behavior, silently ignoring notification calls if one is outstanding, is a bit suspect, but is
         * required when loading mock infrastructure when the app is already loaded. In this case the notification
         * service was running against the real server, and has an outstanding call that will return when it times
         * out. Meanwhile, the mock infrastructure is loaded and we have an active 'pendingNotificationCallback' set.
         * When the original ajax call returns we want to ignore it, but keep the one started by the mock
         * infrastructure. Without adding support to the notification module to track outstanding requests, a
         * significant increase in complexity, this is the only workable solution.
         */
        if (!pendingNotificationCallback) {
            pendingNotificationCallback = _.once(function() {
                pendingNotificationCallback = null;
                runAjax();
            });
        }
        return;
    } else {
        runAjax();
    }
}

// Convenience function to get (or create) a singleton object
function getSingleton(typeName) {
    if (!objects[typeName]) {
        objects[typeName] = {
            type: typeName
        };
    }
    return objects[typeName];
}

// Convenience function to get (or create) a collection of objects
function getCollection(typeName) {
    if (!objects[typeName]) {
        objects[typeName] = [];
    }
    return objects[typeName];
}

function buildRootOperationHandlers(schema) {
    var name = schema.name;

    if (schema.rootOperations) {
        _.each(schema.rootOperations, function (operationInfo, operationName) {
            var httpMethod = 'payload' in operationInfo ? 'POST' : 'GET';
            rootOpHandlers[httpMethod + ':' + schema.root + '/' + operationName] = function(payload) {
                if (rootOperations[name] && rootOperations[name][operationName]) {
                    var userFunction = rootOperations[name][operationName];
                    return userFunction(payload);
                } else {
                    dx.fail('Test called ' + schema.root + '/' + operationName +
                        ', but no such operation registered.');
                }
            };
        });
    }
}

function buildHandlersForSingletonSchema(schema) {
    var name = schema.name;

    if (schema.read) {
        staticHandlers['GET:' + schema.root] = function() {
            if (standardOperations[name] && standardOperations[name].read) {
                var userFunction = standardOperations[name].read;
                return userFunction();
            } else {
                return getSingleton(name);
            }
        };
    }

    /*
     * Singletons can have only an update or a create, but not both (there is no reference property to distinguish them
     * as there is with ordinary objects
     */
    if (schema.update || schema.create) {
        staticHandlers['POST:' + schema.root] = function(config) {
            var userProvidedHandlers = standardOperations[name] || {};

            if (schema.create) {
                if (userProvidedHandlers.create) {
                    return userProvidedHandlers.create(config);
                }
                var objectsToCreate = {};
                objectsToCreate[name] = config.data;

                createObjects(objectsToCreate);
            } else {
                if (userProvidedHandlers.update) {
                    return userProvidedHandlers.update(config);
                }
                // 'type' is inferred by the url and is not part of the data, but is expected by updateObjects
                config.data.type = name;
                updateObjects([config.data]);
            }

            return null;
        };
    }

    buildRootOperationHandlers(schema);
}

function buildHandlersForCollectionSchema(schema) {
    var name = schema.name;

    // list - return the current list of objects
    if (schema.list) {
        staticHandlers['GET:' + schema.root] = function(config) {
            if (standardOperations[name] && standardOperations[name].list) {
                var userFunction = standardOperations[name].list;
                return userFunction(config);
            } else {
                var result = getCollection(name);

                if (_.isObject(config.data) && dx.test.mockServer._filters[name]) {
                    result = dx.test.mockServer._filters[name](result, config.data);
                }

                // Object notifications are special in that they automatically disappear once read
                if (name == 'Notification') {
                    var orig = result;
                    result = result.slice(0);
                    orig.length = 0;
                }
                return result;
            }
        };
    }

    // create - add the object to the collection and return a reference
    if (schema.create) {
        staticHandlers['POST:' + schema.root] = function(config) {
            if (standardOperations[name] && standardOperations[name].create) {
                var userFunction = standardOperations[name].create;
                return userFunction(config);
            } else {
                var data = config.data;

                if (data.type !== name) {
                    dx.fail('MockServer: You are trying to create a ' + name + ' but received a payload of type ' +
                        data.type + '. Please use addStandardOperations() to roll your own $$create() logic.');
                }

                data.reference = name.toUpperCase() + '-' + (nextReference++);
                data.type = name;

                var objectsToCreate = {};
                objectsToCreate[name] = [data];

                createObjects(objectsToCreate);

                return data.reference;
            }
        };
    }

    // read - find the target object and return it
    if (schema.read) {
        objectHandlers['GET:' + schema.root + TRAILING_REF] = function(ref) {
            var result = _.find(getCollection(name), function(o) { return o.reference == ref; });
            if (result === undefined) {
                throw new InternalHttpError('Tried to get an object that doesn\'t exist (' + ref + ')',
                    404, 'Not found', makeObjectMissingResult(name, ref, 'read'));
            }

            if (standardOperations[name] && standardOperations[name].read) {
                var userFunction = standardOperations[name].read;
                return userFunction(ref);
            } else {
                return result;
            }
        };
    }

    // update - find the target object and overlay new properties
    if (schema.update) {
        objectHandlers['POST:' + schema.root  + TRAILING_REF] = function(ref, config) {
            var existing = _.find(getCollection(name), function(o) { return o.reference == ref; });
            if (existing) {
                if (standardOperations[name] && standardOperations[name].update) {
                    var userFunction = standardOperations[name].update;
                    return userFunction(ref, config);
                } else {
                    /*
                     * 'reference' is inferred by the url and is not part of the data already, but is expected
                     * by updateObjects.
                     */
                    config.data.reference = existing.reference;
                    updateObjects([config.data]);
                }
            } else {
                throw new InternalHttpError('Tried to update an object that doesn\'t exist (' + ref + ')',
                    404, 'Not found', makeObjectMissingResult(name, ref, 'update'));
            }

            return null;
        };
    }

    // delete - remove the object from the collection
    if (schema['delete']) {
        objectHandlers['DELETE:' + schema.root + TRAILING_REF] = function(ref, payload) {
            var existing = objectExistsInType(ref, name);
            if (existing) {
                if (standardOperations[name] && standardOperations[name]['delete']) {
                    var userFunction = standardOperations[name]['delete'];
                    return userFunction(ref, payload);
                } else {
                    deleteObjects([ref]);
                }
            } else {
                throw new InternalHttpError('Tried to delete an object that doesn\'t exist (' + ref + ')',
                    404, 'Not found', makeObjectMissingResult(name, ref, 'delete'));
            }

            return null;
        };
    }

    buildRootOperationHandlers(schema);

    if (schema.operations) {
        _.each(schema.operations, function (operationInfo, operationName) {
            var httpMethod = 'payload' in operationInfo ? 'POST' : 'GET';
            objectOpHandlers[httpMethod + ':' + schema.root +
                             INLINE_REF + operationName] = function(objectRef, payload) {
                if (objectOperations[name] && objectOperations[name][operationName]) {
                    var existing = objectExistsInType(objectRef, name);
                    if (existing) {
                        var userFunction = objectOperations[name][operationName];
                        return userFunction(objectRef, payload);
                    } else {
                        throw new InternalHttpError('Tried to call with an object that doesn\'t exist (' +
                            objectRef + ')', 404, 'Not found', makeObjectMissingResult(name, objectRef, operationName));
                    }
                } else {
                    dx.fail('Test called ' + schema.root + '/' + objectRef + '/' +
                        operationName + ', but no such operation registered.');
                }
            };
        });
    }
}

/**
 * Sets set of objects in the mock server. When called with a parameter, the parameter is used to set the objects that
 * this mock server has available to operate on.  Note that this will add a type and reference to each object if it
 * doesn't already have one.
 *
 * The parameter is expected to be a hash of the following form:
 *    {
 *        schemaCollectionType : [ {
 *            { ... properties ... },
 *            { ... properties ... }
 *        } ],
 *        schemaSingletonType : { ... properties ... }
 *    }
 */
function setObjects(newObjects) {
    objects = {};

    createObjects(newObjects, true);
}

/**
 * Returns the object with the specified reference, or undefined if no such object. If a type is specified, this may
 * use a faster algorithm to look up the object.
 */
function getObject(objectRef, type) {
    if (type !== undefined) {
        return _.find(objects[type], function(obj) { return obj.reference == objectRef; });
    } else {
        var matchedObject;
        _.find(objects, function(singletonOrCollection) {
            if (_.isArray(singletonOrCollection)) {
                matchedObject = _.find(singletonOrCollection, function(anObject) {
                    return (anObject.reference == objectRef);
                });
                return (matchedObject !== undefined);
            } else {
                if (singletonOrCollection.reference == objectRef) {
                    matchedObject = singletonOrCollection;
                    return true;
                }
                return false;
            }
        });
        return matchedObject;
    }
}

/**
 * Returns the number of times the mock API has been called.
 */
function getAjaxCallCount() {
    return callCount;
}

/**
 * Invoke any queued calls to success, error, or statusCode routines that resulted from calls to $.ajax(). This is the
 * equivalent of delivering HTTP responses to the client.  We need these callbacks to be executed asynchronously to
 * preserve proper execution semantics. But async tests are a pain to write, so we adopt a hybrid where tests can call
 * this to explicitly finish the psuedo-async interaction. We wait until there are no pending calls, in case a callback
 * itself initiates a request, unless respondUntilEmpty is set. If maxResponseCount it set, only maxReponseCount will
 * be processed.
 */
function respond(onlyRespondOnce, maxResponseCount) {
    var executeCallback = function(cb) {
        cb();
    };

    var remainingResponses = maxResponseCount;
    var currentCallbacks;
    do {
        if (maxResponseCount) {
            var responsesToProcess = Math.min(pendingCallbacks.length, remainingResponses);
            remainingResponses -= responsesToProcess;
            currentCallbacks = pendingCallbacks.splice(0, responsesToProcess);
            _.each(currentCallbacks, executeCallback);
            if (remainingResponses === 0) {
                break;
            }
        } else {
            currentCallbacks = pendingCallbacks;
            pendingCallbacks = [];
            _.each(currentCallbacks, executeCallback);
        }
    } while (!onlyRespondOnce && pendingCallbacks.length);
}

/**
 * See respond for a completion description of the respond semantic.
 * This variant of respond only processes pending requests and does not process new request initiated in a callback.
 */
function respondOnlyToCurrent() {
    respond(true);
}

/*
 * Sets the 'standard (CRUD) object operations' that can be on the mock server.
 *
 * The parameter is a hash of the following form:
 *    {
 *        schemaCollectionType : {
 *            list: function(config) {},
 *            create: function(config) {},
 *            read: function(ref) {},
 *            update: function(ref, config) {},
 *            delete: function(ref) {}
 *        },
 *        ...
 *    }
 *
 * You may override any of the standard operations that are supported for a given type. MockServer already provides
 * default implementations of these handlers, but overriding these may be useful in certain cases, such as testing
 * various failure scenarious as well as being able to spy on these operations.
 * Any operations defined in the parameter will replace their equivalents already installed in the mock server, if any.
 * This does not check that the input parameters are valid, in order to improve performance.
 */
function addStandardOperations(operationHash) {
    _.each(operationHash, function(ops, type) {
        standardOperations[type] = standardOperations[type] || {};
        _.extend(standardOperations[type], ops);
    });
}

/*
 * Create and return a Jasmine spy that is added for the specified standard operation for the specified type.
 */
function spyOnStandardOperation(typeName, operationName) {
    var spy = jasmine.createSpy(typeName + '.' + operationName + 'Spy');

    standardOperations[typeName] = standardOperations[typeName] || {};
    standardOperations[typeName][operationName] = spy;

    return spy;
}

/*
 * Sets the 'root operations' that can be on the mock server.
 *
 * The parameter is a hash of the following form:
 *    {
 *        schemaCollectionType : {
 *            rootOperationName: function() {},
 *            rootOperationName: function() {}
 *        },
 *        schemaSingletonType: {
 *            rootOperationName: function() {}
 *        },
 *        ...
 *    }
 * If any of the operations already exist in the server, they will be replaced with the value in the params.
 * This does not check that the input parameters are valid, in order to improve performance.
 */
function addRootOperations(operationHash) {
    _.each(operationHash, function(ops, type) {
        rootOperations[type] = rootOperations[type] || {};
        _.extend(rootOperations[type], ops);
    });
}

/*
 * Create and return a Jasmine spy that is added for the specified root operation for the specified type.
 */
function spyOnRootOperation(typeName, operationName) {
    var spy = jasmine.createSpy(typeName + '.' + operationName + 'Spy');

    rootOperations[typeName] = rootOperations[typeName] || {};
    rootOperations[typeName][operationName] = spy;

    return spy;
}

/*
 * Adds one or more 'object operations' that can be on the mock server.
 *
 * The parameter is a hash of the following form:
 *    {
 *        schemaCollectionType : {
 *            operationName: function() {},
 *            operationName: function() {}
 *        },
 *        ...
 *    }
 *
 * If any of the operations already exist in the server, they will be replaced with the value in the params.
 * This does not check that the input parameters are valid, in order to improve performance.
 */
function addObjectOperations(operationHash) {
    _.each(operationHash, function(ops, type) {
        objectOperations[type] = objectOperations[type] || {};
        _.extend(objectOperations[type], ops);
    });
}

/*
 * Create and return a Jasmine spy that is added for the specified object operation for the specified type.
 */
function spyOnObjectOperation(typeName, operationName) {
    var spy = jasmine.createSpy(typeName + '.' + operationName + 'Spy');

    objectOperations[typeName] = objectOperations[typeName] || {};
    objectOperations[typeName][operationName] = spy;

    return spy;
}

/**
 * Sets the resources that can be called from a test.  In this case, a resource is an arbitrary string associated with
 * the full path portion of a URL.  This can be useful, for example, to register templates with the mock server that
 * can then be requested from a test.
 *
 * For example, this might be called with:
 * {
 *     '/test/template/basic.hjs': '<div id=basicTest></div>'
 * }
 *
 * This does not check that the input parameters are valid, in order to improve performance.
 *
 * The parameter is a hash of the following form:
 *    {
 *        URL : data,
 *        ...
 *    }
 */
function setResources(resourcesHash) {
    resources = resourcesHash;
}

function publicGetCollection(typeName) {
    var result = objects[typeName];
    if (_.isArray(result)) {
        return result;
    }
}

function publicGetSingleton(typeName) {
    var result = objects[typeName];

    if (!_.isArray(result)) {
        return result;
    }
}

/**
 * Reset all the 'user' provided data in this mock server. Delete all objects, root operations and object operations.
 */
function reset() {
    nextReference = START_REF;
    callCount = 0;
    pendingCallbacks = [];
    setObjects({});
    setResources({});
    standardOperations = {};
    rootOperations = {};
    objectOperations = {};
}

/*
 * Helper function to post an array of notifications.
 */
function postNotifications(notifications) {
    if (notifications.length > 0) {
        createObjects({
            Notification: notifications
        }, true);

        // Kick off any pending notification request if present
        if (pendingNotificationCallback)
            setTimeout(pendingNotificationCallback, 0);
    }
}

/*
 * Changes the mode of operation (browser or test) based on the argument. This is only called when bootstrapping
 * the mock server into the browser. In browser mode, async $.ajax requests are handled via setTimeout(). In non-browser
 * mode, all async requests are queued for delivery until respond() is called, at which point they are all all invoked
 * synchronously. Regardless of mode, synchronous $.ajax calls are always handled synchronously.
 */
function setBrowserMode(newBrowserMode) {
    browserMode = newBrowserMode;
}

function getBrowserMode() {
    return browserMode;
}

/*
 * Add new objects to the system. Unlike setObjects(), this will augment the current set of objects, and create
 * object change notifications for each one. This is used in integration context, where we want to overlay
 * objects on top of the default mock implementation. The format of 'newObjects' is the same as in setObjects().
 *
 * The 'skipNotifications' argument is purely for internal use, and is set when invoking this function from
 * setObjects() context.
 */
function createObjects(newObjects, skipNotifications) {

    var notifications = [];

    _.each(newObjects, function (s, typeName) {
        if (_.isArray(s)) {
            if (!objects[typeName]) {
                objects[typeName] = [];
            }
            objects[typeName] = objects[typeName].concat(s);

            // For convenience, set the type and reference if needed
            _.each(s, function (o) {
                if (!o.type)
                    o.type = typeName;

                if (o.type !== 'ObjectNotification' && o.type !== 'SingletonUpdate' && o.type !== 'NotificationDrop') {
                    if (!o.reference)
                        o.reference = o.type.toUpperCase() + '-' + (nextReference++);

                    if (!skipNotifications) {
                        notifications.push({
                            type: 'ObjectNotification',
                            eventType: 'CREATE',
                            objectType: o.type,
                            object: o.reference
                        });
                    }
                }
            });
        } else {
            objects[typeName] = s;
            // Set the type if needed
            if (!s.type)
                s.type = typeName;

            if (!skipNotifications) {
                notifications.push({
                    type: 'SingletonUpdate',
                    objectType: typeName
                });
            }
        }
    });

    postNotifications(notifications);
}

/*
 * Delete the given objects, removing them from server side state and posting and requisite change notifications. The
 * format of the 'objectsToDelete' is an array of references:
 *
 *      [ reference, reference, ... ]
 *
 * It is not possible to delete singleton objects.
 *
 * Note that this is not particularly efficient, running in O(m * n), but for the scale we expect in testing it should
 * be sufficient.
 */
function deleteObjects(objectsToDelete) {
    var newObjects = {};
    var notifications = [];

    _.each(objects, function (objects, type) {
        // Skip singletons
        if (!_.isArray(objects)) {
            newObjects[type] = objects;
            return;
        }

        var matchFunc = function(o) {
            return _.indexOf(objectsToDelete, o.reference) !== -1;
        };

        newObjects[type] = _.reject(objects, matchFunc);
        var toDelete = _.filter(objects, matchFunc);

        _.each(toDelete, function(o) {
            notifications.push({
                type: 'ObjectNotification',
                eventType: 'DELETE',
                objectType: type,
                object: o.reference
            });
        });
    });

    objects = newObjects;
    postNotifications(notifications);
}

/*
 * Overlays dst with src while being schema aware so that plain objects are overwritten
 */
function updateObject(dst, src) {
    _.each(src, function (propval, propname) {
        if (_.isArray(propval)) {
            dst[propname] = dx.core.util.deepClone(propval);
        } else if (_.isObject(propval)) {
            var schema = dx.core.data.parsedSchemas[dst.type];
            if (_.isUndefined(schema)) {
                dx.fail('Attempting to update object with a type that doesn\'t exist in the schema: ' + dst.type);
            }
            if (_.isUndefined(schema.properties[propname])) {
                dx.fail('Attempting to update an invalid property named ' + propname + ' on object of type ' +
                    dst.type);
            }

            if (_.isDate(propval)) {
                // Date isn't a normal object and so must be handled specially and copied over whole
                dst[propname] = new Date(propval.getTime());
            } else if (_.isUndefined(schema.properties[propname].$ref)) {
                // The object property is a plain object, overwrite it
                dst[propname] = dx.core.util.deepClone(propval);
            } else {
                 if (!_.isObject(dst[propname])) {
                    dst[propname] = {};
                 }
                updateObject(dst[propname], propval);
            }
        } else {
            dst[propname] = propval;
        }
    });

    return dst;
}

/*
 * Update the given objects, overlaying contents and posting requisite change notifications. The input to this is
 * an array of partial objects:
 *
 * [
 *      { reference: 'ref', property: value, ... },
 *      ...
 * ]
 *
 * These objects require 'reference', unless the object is a singleton, in which case 'type' is required.
 */
function updateObjects(objectsToUpdate) {
    var notifications = [];

    _.each(objectsToUpdate, function(o, providedType) {
        var tgt = o.reference ? getObject(o.reference) : getSingleton(o.type ? o.type : providedType);

        if (!tgt)
            return;

        updateObject(tgt, o);
        if (tgt.reference) {
            notifications.push({
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: tgt.type,
                object: tgt.reference
            });
        } else {
            notifications.push({
                type: 'SingletonUpdate',
                objectType: tgt.type
            });

        }
    });

    postNotifications(notifications);
}

var jQueryAjax = $.ajax;
var dxGetWindowLocation = dx.core.browser.getWindowLocation;

/*
 * Start the mock server, by redirecting all jquery ajax calls to it.
 */
function startMockServer() {
    $.ajax = mockServerAjaxHandler;

    // Hack to get around a problem for testing
    dx.core.browser.getWindowLocation = function() {
        return {
            origin: '',
            hash: ''
        };
    };
}

/*
 * Turn off the mock server. This is to say, let all calls flow back out to the network and to real servers.
 */
function stopMockServer() {
    $.ajax = jQueryAjax;
    dx.core.browser.getWindowLocation = dxGetWindowLocation;
}

// Build the handlers based on the schema. This only needs to be executed once
_.each(delphixSchema, function(schema, schemaKey) {
    if (schema.root) {

        // Some schemas have no name. For these use the schemaKey (the name of the json file)
        if (!schema.name) {
            // don't modify the original schema
            schema = dx.core.util.deepClone(schema);
            schema.name = schemaKey.replace(/\.json$/, '').
                replace(/-/g, '_').
                replace(/\//g, '');
        }

        if (schema.singleton) {
            buildHandlersForSingletonSchema(schema);
        } else {
            buildHandlersForCollectionSchema(schema);
        }
    }
});

// define the public api
_.extend(dx.test.mockServer, {
    start: startMockServer,
    stop: stopMockServer,
    setObjects: setObjects,
    setResources: setResources,
    addStandardOperations: addStandardOperations,
    spyOnStandardOperation: spyOnStandardOperation,
    addRootOperations: addRootOperations,
    spyOnRootOperation: spyOnRootOperation,
    addObjectOperations: addObjectOperations,
    spyOnObjectOperation: spyOnObjectOperation,
    reset: reset,
    respond: respond,
    respondOnlyToCurrent: respondOnlyToCurrent,
    getAjaxCallCount: getAjaxCallCount,
    getObject: getObject,
    getCollection: publicGetCollection,
    getSingleton: publicGetSingleton,
    setBrowserMode: setBrowserMode,
    getBrowserMode: getBrowserMode,
    createObjects: createObjects,
    deleteObjects: deleteObjects,
    updateObjects: updateObjects,
    makeMockServerResponse: publicMakeMockServerResponse,
    jQueryAjax: jQueryAjax
});

})();
