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

/*global dx, $, _, delphixSchema */

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
 * $.ajax() is overriden as soon as start() is called, and is restored when stop() is called.
 *
 * Functions:
 *      createObjects()
 *      updateObjects()
 *      deleteObjects()
 *
 * These three routines add, update and delete objects and singletons in the mock server, respectively. By default,
 * each also creates the appropriate Notification objects (e.g. object creation notifications) for non-singleton
 * objects, though this can be overridden with a second argument.  The first argument to each can be either an object
 * or an array.
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
 * More functions:
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
 * After the operation handler has been installed, any call to that operation on the mock server will invoke the
 * handler.  Note that if a handler already exists in the server, a second addFooOperation call will replace the first.
 * The singular forms all take arguments in this form:
 *    addFooOperation(RootTypeName, operationName, function() {});
 * These operate identically, but are terser if you have just a single operation to register.
 *
 * More functions:
 *      addResources()
 *
 * This is just used to register values that should be returned when a particular URL is GET'ed from the server.
 */
(function() {
var INLINE_REF = '/{ref}/';
var TRAILING_REF = '/{ref}';
var MOCK_SERVER_RESPONSE_TYPE = 'MockServerResponse';

// data and operations provided by the client
var objects = {};
var singletons = {};
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
var schemasByName = {};
var STANDARD_OPERATONS = ['list', 'read', 'create', 'update', 'delete'];

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
 *           dx.test.mockServer.addRootOpHandlers({
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
 *          dx.test.mockServer.addRootOpHandlers({
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
    return _.find(getCollection(typeName), function(o) { return o.reference === objectRef; }) ? true : false;
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
                if (hdr === 'X-HTTP-Method-Override' && value === 'DELETE') {
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
                if (config.dataType === 'script') {
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
    if (browserMode && (path === 'GET:' + delphixSchema['/delphix-notification.json'].root)) {
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

/*
 * Returns the object with the specified reference, or undefined if no such object. If a type is specified, this may
 * use a faster algorithm to look up the object.
 */
function getObject(objectRef, type) {
    if (type) {
        return _.find(objects[type], function(obj) { return obj.reference === objectRef; });
    } else {
        var matchedObject;
        _.find(objects, function(singletonOrCollection) {
            if (_.isArray(singletonOrCollection)) {
                matchedObject = _.find(singletonOrCollection, function(anObject) {
                    return anObject.reference === objectRef;
                });
                return (matchedObject !== undefined);
            } else {
                if (singletonOrCollection.reference === objectRef) {
                    matchedObject = singletonOrCollection;
                    return true;
                }
                return false;
            }
        });
        return matchedObject;
    }
}

function isSingleton(typeName) {
    var schema = schemasByName[typeName];
    return (schema && schema.singleton);
}

// Convenience function to get (or create) a singleton object
function getSingleton(typeName) {
    var schema = schemasByName[typeName];
    if (!schema || !schema.singleton) {
        dx.fail(typeName + ' is not a singleton type.');
    }

    if (!singletons[typeName]) {
        singletons[typeName] = {
            type: typeName
        };
    }

    return singletons[typeName];
}

// Convenience function to get (or create) a collection of objects
function getCollection(typeName) {
    var schema = schemasByName[typeName];
    if (schema.singleton) {
        dx.fail(typeName + ' is not a root collection type.');
    }

    if (!objects[typeName]) {
        objects[typeName] = [];
    }
    return objects[typeName];
}

function buildRootOperationHandlers(schema) {
    var name = schema.name;

    if (schema.rootOperations) {
        _.each(schema.rootOperations, function(operationInfo, operationName) {
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
                if (name === 'Notification') {
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
                        data.type + '. Please use addStandardOpHandlers() to roll your own $$create() logic.');
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
            var result = _.find(getCollection(name), function(o) { return o.reference === ref; });
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
            var existing = _.find(getCollection(name), function(o) { return o.reference === ref; });
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
    if (schema.delete) {
        objectHandlers['DELETE:' + schema.root + TRAILING_REF] = function(ref, payload) {
            var existing = objectExistsInType(ref, name);
            if (existing) {
                if (standardOperations[name] && standardOperations[name].delete) {
                    var userFunction = standardOperations[name].delete;
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
        _.each(schema.operations, function(operationInfo, operationName) {
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
function createObjects(newObjects, skipNotifications) {
    processArgumentsWithHandler(newObjects, skipNotifications, createObject);
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
function createObject(newObject, skipNotification) {
    if (!newObject.type) {
        dx.fail('No type property found on object.', newObject);
    }

    makeValuesJSON(newObject);

    var schema = schemasByName[newObject.type];
    if (!schema) {
        dx.fail(newObject.type + ' is not a known schema type.');
    }

    if (schema.singleton) {
        singletons[newObject.type] = newObject;

        if (!skipNotification) {
            postNotifications([{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        var rootType = getRootTypeForObject(schema);
        var shouldHaveReference = !!getPropDef(schema, 'reference');

        if (!rootType) {
            dx.fail(newObject.type + ' is not a type descended from one with a root property.');
        }

        objects[rootType] = objects[rootType] || [];
        objects[rootType].push(newObject);

        if (shouldHaveReference && !newObject.reference) {
            newObject.reference = newObject.type.toUpperCase() + '-' + nextReference;
            nextReference++;
        }

        // Notifications only make sense for an object with a reference
        if (newObject.reference && !skipNotification) {
            postNotifications([{
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: newObject.type,
                object: newObject.reference
            }]);
        }
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
function updateObjects(objectsToUpdate, skipNotifications) {
    processArgumentsWithHandler(objectsToUpdate, skipNotifications, updateObject);
}

function updateObject(newObject, skipNotification) {
    makeValuesJSON(newObject);

    var schema = schemasByName[newObject.type];

    if (schema && schema.singleton) {
        updateObjectProperties(getSingleton(newObject.type), newObject);

        if (!skipNotification) {
            postNotifications([{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        if (!newObject.reference) {
            dx.fail('Can not update an object without at least a reference.');
        }
        var existing = getObject(newObject.reference);

        if (!existing) {
            dx.fail('There is no object with the reference ' + newObject.reference + ' to update.');
        }

        updateObjectProperties(existing, newObject);

        if (!skipNotification) {
            postNotifications([{
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
function updateObjectProperties(targetObject, newProperties) {
    _.each(newProperties, function(propval, propname) {
        if (_.isObject(propval)) {
            var schema = schemasByName[targetObject.type];
            var propDef = getPropDef(schema, propname);

            if (propDef && propDef.$ref) {
                if (!_.isObject(targetObject[propname])) {
                    targetObject[propname] = {};
                }
                updateObjectProperties(targetObject[propname], propval);
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
function deleteObjects(objectsToDelete, skipNotifications) {
    processArgumentsWithHandler(objectsToDelete, skipNotifications, deleteObject);
}

function deleteObject(doomedObjectOrRef, skipNotifications) {
    var targetReference = doomedObjectOrRef;

    if (_.isObject(doomedObjectOrRef)) {
        targetReference = doomedObjectOrRef.reference;
    }

    if (!targetReference) {
        dx.fail('No reference provided to identify the object to delete.');
    }

    if (isSingleton(targetReference)) {
        dx.fail('Can not delete singletons (' + targetReference + ' is a singleton).');
    }

    var deletedIt = _.find(objects, function(objectsArray) {
        return _.find(objectsArray, function(anObject, index) {
            if (anObject.reference === targetReference) {
                objectsArray.splice(index, 1);

                if (!skipNotifications) {
                    postNotifications([{
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
 * Modifies the provided object so that its values are all JSON-compatible.  Specifically
 * this replaces 'undefined' with 'null', and replaces Date instances with JSON-compatible strings.
 */
function makeValuesJSON(anObject) {
    _.each(anObject, function(value, key) {
        if (_.isUndefined(value)) {
            anObject[key] = null;
        } else if (_.isDate(value)) {
            anObject[key] = value.toJSON();
        } else if (_.isArray(value)) {
            _.each(value, makeValuesJSON);
        } else if (_.isObject(value)) {
            makeValuesJSON(value);
        }
    });
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
    var copyOfObjects =  dx.core.util.deepClone(objectsToProcess);
    if (_.isArray(copyOfObjects)) {
        for (var index = 0; index < copyOfObjects.length; index++) {
            handler(copyOfObjects[index], skipNotifications);
        }
    } else {
        _.each(copyOfObjects, function(objectOrArray, typeName) {
            if (_.isArray(objectOrArray)) {
                for (var ctr = 0; ctr < objectOrArray.length; ctr++) {
                    var anObject = objectOrArray[ctr];
                    addTypeIfNeeded(anObject, typeName);
                    handler(anObject, skipNotifications);
                }
            } else {
                addTypeIfNeeded(objectOrArray, typeName);
                handler(objectOrArray, skipNotifications);
            }
        });
    }
}

function addTypeIfNeeded(obj, typeName) {
    if (!obj.type) {
        obj.type = typeName;
    }
}
/*
 * Sets the 'standard (CRUD) object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 *
 * You may override any of the standard operations that are supported for a given type. MockServer already provides
 * default implementations of these handlers, but overriding these may be useful in certain cases, such as testing
 * various failure scenarious as well as being able to spy on these operations.
 * Any operations defined in the parameter will replace their equivalents already installed in the mock server, if any.
 */
function addStandardOpHandlers(operationHash) {
    if (!_.isObject(operationHash)) {
        dx.fail('Expected an object, but got a ' + (typeof operationHash) + '.');
    }

    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addStandardOpHandler(type, oName, oFunc);
        });
    });
}

/*
 * Like addStandardOpHandlers(), but instead adds a single operation.
 */
function addStandardOpHandler(typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got a ' + typeof typeName + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got a ' + typeof opName + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got a ' + typeof opHandler + '.');
    }
    if (!schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!_.contains(opName, STANDARD_OPERATONS) && !schemasByName[typeName][opName]) {
        dx.fail(opName + ' is not one of the standard operations (' + STANDARD_OPERATONS.join(', ') + ').');
    }

    standardOperations[typeName] = standardOperations[typeName] || {};
    standardOperations[typeName][opName] = opHandler;
}

/*
 * Sets the 'root operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addRootOpHandlers(operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addRootOpHandler(type, oName, oFunc);
        });
    });
}

/*
 * Like addRootOpHandlers(), but instead adds a single operation.
 */
function addRootOpHandler(typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got a ' + typeof typeName + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got a ' + typeof opName + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got a ' + typeof opHandler + '.');
    }
    if (!schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!schemasByName[typeName].rootOperations || !schemasByName[typeName].rootOperations[opName]) {
        dx.fail(opName + ' is not a root operation on ' + typeName + '.');
    }

    rootOperations[typeName] = rootOperations[typeName] || {};
    rootOperations[typeName][opName] = opHandler;
}

/*
 * Adds one or more 'object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addObjectOpHandlers(operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addObjectOpHandler(type, oName, oFunc);
        });
    });
}

/*
 * Like addObjectOpHandlers(), but instead adds a single operation.
 */
function addObjectOpHandler(typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got a ' + typeof typeName + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got a ' + typeof opName + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got a ' + typeof opHandler + '.');
    }
    if (!schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!schemasByName[typeName].operations || !schemasByName[typeName].operations[opName]) {
        dx.fail(opName + ' is not an object operation on ' + typeName + '.');
    }

    objectOperations[typeName] = objectOperations[typeName] || {};
    objectOperations[typeName][opName] = opHandler;
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
function addResources(resourcesHash) {
    _.extend(resources, resourcesHash);
}

/*
 * Reset all the 'user' provided data in this mock server. Delete all objects, root operations and object operations.
 */
function reset() {
    nextReference = START_REF;
    callCount = 0;
    pendingCallbacks = [];
    objects = {};
    singletons = {};
    resources = {};
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
 * Returns the number of times the mock API has been called.
 */
function getAjaxCallCount() {
    return callCount;
}

/*
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
    $.event.trigger('ajaxComplete');
}

/*
 *
 * See respond for a completion description of the respond semantic.
 * This variant of respond only processes pending requests and does not process new request initiated in a callback.
 */
function respondOnlyToCurrent() {
    respond(true);
}

/*
 * See respond for a completion description of the respond semantic.
 * This variant of respond only processes pending requests and does not process new request initiated in a callback.
 */

function setBrowserMode(newBrowserMode) {
    browserMode = newBrowserMode;
}

function getBrowserMode() {
    return browserMode;
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

function fixName(schemaKey) {
    return schemaKey.replace(/\.json$/, '').
        replace(/-/g, '_').
        replace(/\//g, '');
}

// Returns the property definition if instances of the specified schema have a specific property, undefined otherwise
function getPropDef(schema, propName) {
    if (schema.properties && schema.properties[propName]) {
        return schema.properties[propName];
    }

    if (schema.extends && schema.extends.$ref) {
        return getPropDef(schemasByName[schema.extends.$ref], propName);
    }
}

// Returns the name of the root type for the specified schema, or undefined.
function getRootTypeForObject(schema) {
    if (schema.root) {
        return schema.name;
    }

    if (schema.extends && schema.extends.$ref) {
        return getRootTypeForObject(schemasByName[schema.extends.$ref]);
    }
}

// Fix all the names for all the schemas, and store them by name
_.each(delphixSchema, function(schema, schemaKey) {
    // don't modify the original schema
    var schemaCopy = dx.core.util.deepClone(schema);
    if (!schemaCopy.name) {
        schemaCopy.name = fixName(schemaKey);
    }
    schemasByName[schemaCopy.name] = schemaCopy;
});

// Fix internal references to the schemas and build the callback handlers for all operations.
_.each(schemasByName, function(schema) {
    if (schema.extends) {
        schema.extends.$ref = fixName(delphixSchema[schema.extends.$ref].name);
    }

    if (schema.root) {
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
    createObjects: createObjects,
    updateObjects: updateObjects,
    deleteObjects: deleteObjects,
    addResources: addResources,
    addStandardOpHandlers: addStandardOpHandlers,
    addStandardOpHandler: addStandardOpHandler,
    addRootOpHandlers: addRootOpHandlers,
    addRootOpHandler: addRootOpHandler,
    addObjectOpHandlers: addObjectOpHandlers,
    addObjectOpHandler: addObjectOpHandler,
    getObject: getObject,
    getCollection: getCollection,
    getSingleton: getSingleton,
    reset: reset,
    respond: respond,
    respondOnlyToCurrent: respondOnlyToCurrent,
    getAjaxCallCount: getAjaxCallCount,
    setBrowserMode: setBrowserMode,
    getBrowserMode: getBrowserMode,
    makeMockServerResponse: publicMakeMockServerResponse,
    jQueryAjax: jQueryAjax
});

})();
